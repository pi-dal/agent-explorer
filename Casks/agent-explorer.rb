cask "agent-explorer" do
  version "0.2.2"
  sha256 "ad7397f13694fca6790e55b4569316fe802bb14120572dd97915afb92782edef"

  url "https://github.com/pi-dal/agent-explorer/releases/download/v#{version}/Agent.Explorer_#{version}_aarch64.dmg"
  name "Agent Explorer"
  desc "Browser-based explorer for agent session logs"
  homepage "https://github.com/pi-dal/agent-explorer"

  depends_on :macos
  depends_on arch: :arm64

  app "Agent Explorer.app"
end
