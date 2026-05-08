{
  description = "OBSBot Web Control - remote PTZ widget for OBSBot Tiny SE";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            pnpm
            python3
            pkg-config
            gnumake
          ] ++ pkgs.lib.optionals pkgs.stdenv.isLinux [
            gcc
          ] ++ pkgs.lib.optionals pkgs.stdenv.isDarwin [
            clang
          ];

          shellHook = ''
            export npm_config_python="${pkgs.python3}/bin/python3"
            echo "OBSBot Web Control dev shell"
            echo "  node $(node --version)"
            echo "  pnpm $(pnpm --version)"
          '';
        };
      });
}
