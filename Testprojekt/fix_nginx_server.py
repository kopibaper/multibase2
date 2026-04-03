import sys

path = "/opt/multibase/nginx/sites-enabled/my-project.conf"
with open(path, "r") as f:
    lines = f.readlines()

result = []
in_api_block = False
i = 0

while i < len(lines):
    line = lines[i]
    stripped = line.strip()

    # Detect which server block we are in
    if stripped.startswith("server_name "):
        if "-api." in stripped:
            in_api_block = True
        else:
            in_api_block = False

    if in_api_block:
        # Skip auth_request directive and its surrounding comments
        if stripped == "auth_request /auth-check;":
            i += 1
            continue
        if stripped in ("# Require authentication", "# On auth failure, redirect to login"):
            i += 1
            continue
        if stripped.startswith("error_page 401") or stripped.startswith("error_page 403"):
            i += 1
            continue
        # Update comment
        if "Main API location with authentication" in stripped:
            result.append("    # Main API location - NO auth_request (Supabase uses JWT)\n")
            i += 1
            continue
        # Skip @error location blocks
        if stripped.startswith("location @error4"):
            depth = 0
            while i < len(lines):
                depth += lines[i].count("{")
                depth -= lines[i].count("}")
                i += 1
                if depth <= 0:
                    break
            # Skip following blank line
            if i < len(lines) and lines[i].strip() == "":
                i += 1
            continue
        # Add Authorization header after X-Forwarded-Proto
        if "X-Forwarded-Proto" in stripped and "set_header" in stripped:
            result.append(line)
            auth_line = line.replace("X-Forwarded-Proto $scheme", "Authorization $http_authorization")
            result.append(auth_line)
            i += 1
            continue

    result.append(line)
    i += 1

# Collapse double blank lines
final = []
prev_blank = False
for line in result:
    is_blank = line.strip() == ""
    if is_blank and prev_blank:
        continue
    final.append(line)
    prev_blank = is_blank

with open(path, "w") as f:
    f.writelines(final)

print("OK: nginx config updated")