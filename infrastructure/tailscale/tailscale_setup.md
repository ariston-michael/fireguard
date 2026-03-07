# Tailscale Setup for FireGuard XR

## Install (macOS App Store)
open -a Tailscale

## Sign In
tailscale up

## Expose Backend Publicly
tailscale funnel 8000

## Check Status
tailscale status
tailscale netcheck

## Notes
- App Store version has NO launchd service
- Do NOT run: sudo launchctl kickstart ... io.tailscale.tailscaled
- Use: open -a Tailscale
