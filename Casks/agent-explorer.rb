cask "agent-explorer" do
  version "0.2.1"
  sha256 "baaa089eaa7dd83eae53b7963af3ead88f3aaac75f37d684bfd93b0df898427f"

  url "https://github.com/pi-dal/agent-explorer/releases/download/v#{version}/Agent.Explorer_#{version}_aarch64.dmg"
  name "Agent Explorer"
  desc "Browser-based explorer for agent session logs"
  homepage "https://github.com/pi-dal/agent-explorer"

  depends_on :macos
  depends_on arch: :arm64

  app "Agent Explorer.app"
end
