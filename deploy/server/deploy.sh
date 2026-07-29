#!/usr/bin/env bash
set -Eeuo pipefail

image="${1:?usage: deploy.sh <container-image>}"
app_name="joynext-robotics"
network="atlasfish_proxy"
deploy_root="/root/joynext-deploy"
state_file="${deploy_root}/active-slot"
ai_env_file="${deploy_root}/ai.env"
nginx_container="nginx"
nginx_default_conf="/root/nginx_conf/nginx/conf.d/default.conf"
nginx_location_conf="/root/nginx_conf/nginx/conf.d/joynext.location.inc"
nginx_web_root="/root/nginx_web"
location_template="${deploy_root}/joynext.location.inc"
include_line="    include /etc/nginx/conf.d/joynext.location.inc; # JOYNEXT_DEPLOY_INCLUDE"

mkdir -p "${deploy_root}"
test -f "${location_template}" || {
  echo "Missing ${location_template}" >&2
  exit 66
}

docker network inspect "${network}" >/dev/null 2>&1 || docker network create "${network}" >/dev/null

active_slot=""
if [[ -f "${state_file}" ]]; then
  active_slot="$(tr -d '[:space:]' < "${state_file}")"
fi
if [[ "${active_slot}" == "blue" ]]; then
  next_slot="green"
else
  next_slot="blue"
fi

next_container="${app_name}-${next_slot}"
next_static_name="joynext-static-${next_slot}"
next_static_dir="${nginx_web_root}/${next_static_name}"
old_container=""
old_static_dir=""
if [[ -n "${active_slot}" ]]; then
  old_container="${app_name}-${active_slot}"
  old_static_dir="${nginx_web_root}/joynext-static-${active_slot}"
fi

echo "Pulling ${image}"
docker pull "${image}"
docker rm -f "${next_container}" >/dev/null 2>&1 || true
runtime_env_args=()
if [[ -f "${ai_env_file}" ]]; then
  chmod 600 "${ai_env_file}"
  runtime_env_args=(--env-file "${ai_env_file}")
else
  echo "Warning: ${ai_env_file} is missing; AI assistant will report that it is not configured." >&2
fi
docker run -d \
  --name "${next_container}" \
  --network "${network}" \
  --restart unless-stopped \
  "${runtime_env_args[@]}" \
  --label "com.joynext.application=${app_name}" \
  --label "com.joynext.deployment-slot=${next_slot}" \
  "${image}" >/dev/null

healthy="false"
for attempt in {1..30}; do
  if docker exec "${next_container}" node -e \
    "fetch('http://127.0.0.1:3000/joynext/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
  then
    healthy="true"
    break
  fi
  sleep 2
done

if [[ "${healthy}" != "true" ]]; then
  echo "New container failed its health check." >&2
  docker logs --tail 100 "${next_container}" >&2 || true
  docker rm -f "${next_container}" >/dev/null 2>&1 || true
  exit 1
fi

# Keep static files in the same blue/green slot as the application container.
# The Nginx container already mounts /root/nginx_web at /var/www/html.
if ! {
  rm -rf -- "${next_static_dir}" &&
  mkdir -p "${next_static_dir}" &&
  docker cp "${next_container}:/app/dist/client/." "${next_static_dir}/" &&
  docker cp "${next_container}:/app/public/." "${next_static_dir}/" &&
  test -f "${next_static_dir}/assets/brand/joynext-logo-light.png" &&
  test -f "${next_static_dir}/products/domain-controller.png"
}; then
  echo "Unable to stage static assets for Nginx." >&2
  docker rm -f "${next_container}" >/dev/null 2>&1 || true
  rm -rf -- "${next_static_dir}"
  exit 1
fi

rendered_location="$(mktemp)"
backup_location="$(mktemp)"
backup_default="$(mktemp)"
deployment_switched="false"
cp "${nginx_default_conf}" "${backup_default}"

cleanup() {
  exit_code=$?
  if [[ "${exit_code}" -ne 0 && "${deployment_switched}" != "true" ]]; then
    echo "Deployment failed; restoring the previous Nginx configuration." >&2
    cp "${backup_default}" "${nginx_default_conf}" || true
    if [[ -s "${backup_location}" ]]; then
      cp "${backup_location}" "${nginx_location_conf}" || true
    else
      rm -f "${nginx_location_conf}" || true
    fi
    docker rm -f "${next_container}" >/dev/null 2>&1 || true
    rm -rf -- "${next_static_dir}"
    docker exec "${nginx_container}" nginx -t >/dev/null 2>&1 \
      && docker exec "${nginx_container}" nginx -s reload >/dev/null 2>&1 \
      || true
  fi
  rm -f "${rendered_location}" "${backup_location}" "${backup_default}"
  exit "${exit_code}"
}
trap cleanup EXIT

sed \
  -e "s/__UPSTREAM__/${next_container}/g" \
  -e "s/__STATIC_DIR__/${next_static_name}/g" \
  "${location_template}" > "${rendered_location}"

if [[ -f "${nginx_location_conf}" ]]; then
  cp "${nginx_location_conf}" "${backup_location}"
else
  : > "${backup_location}"
fi

if ! grep -Fq "JOYNEXT_DEPLOY_INCLUDE" "${nginx_default_conf}"; then
  timestamp="$(date +%Y%m%d-%H%M%S)"
  cp "${nginx_default_conf}" "${nginx_default_conf}.bak-joynext-${timestamp}"
  python3 - "${nginx_default_conf}" "${include_line}" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
include_line = sys.argv[2]
text = path.read_text()
anchor = "    # 日志文件路径 (容器内路径)"
if anchor not in text:
    raise SystemExit(f"Unable to find Nginx insertion anchor in {path}")
text = text.replace(anchor, f"{include_line}\n\n{anchor}", 1)
path.write_text(text)
PY
fi

cp "${rendered_location}" "${nginx_location_conf}"
if ! docker exec "${nginx_container}" nginx -t; then
  echo "Nginx validation failed." >&2
  exit 1
fi

docker exec "${nginx_container}" nginx -s reload
printf '%s\n' "${next_slot}" > "${state_file}"
deployment_switched="true"

if [[ -n "${old_container}" && "${old_container}" != "${next_container}" ]]; then
  docker rm -f "${old_container}" >/dev/null 2>&1 || true
fi
if [[ -n "${old_static_dir}" && "${old_static_dir}" != "${next_static_dir}" ]]; then
  rm -rf -- "${old_static_dir}"
fi

echo "Deployment complete: ${next_container} serves /joynext/."
