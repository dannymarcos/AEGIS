# Connectivity notes

This environment currently cannot access GitHub over HTTPS due to a proxy/tunnel restriction.

## Reproduction

```bash
git ls-remote https://github.com/dannymarcos/Ridex.git
curl -I https://github.com/dannymarcos/Ridex
```

## Observed error

- `CONNECT tunnel failed, response 403`
- `HTTP/1.1 403 Forbidden`
