{
  description = "Forge - Local-first AI coding agent";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };

        # 1. Fixed-Output Derivation for node_modules
        forge-deps = pkgs.stdenv.mkDerivation {
          pname = "forge-deps";
          version = "0.1.0";
          
          # Optimization: Only watch package/lock files so changes to source code 
          # don't force Nix to re-evaluate the dependency hash unnecessarily.
          src = pkgs.lib.cleanSourceWith {
            src = ./.;
            filter = path: type: 
              builtins.baseNameOf path == "package.json" || 
              builtins.match ".*bun\\.lockb?" (builtins.baseNameOf path) != null;
          };

          nativeBuildInputs = [ pkgs.bun ];

          dontConfigure = true;
          dontFixup = true; # <-- THE FIX: Prevents Nix from injecting store paths into node_modules scripts

          buildPhase = ''
            export HOME="$TMPDIR"
            bun install --frozen-lockfile --ignore-scripts
          '';

          installPhase = ''
            mkdir -p $out
            cp -r node_modules $out/
          '';

          outputHashAlgo = "sha256";
          outputHashMode = "recursive";
          outputHash = "sha256-5fmTLzLR2QClr5ohSW5Uw7bZ5dzG1UOT4z0rwswBaMg="; 
        };

        # 2. Main Package Derivation
        forge-pkg = pkgs.stdenv.mkDerivation {
          pname = "forge";
          version = "0.1.0";
          src = ./.;

          nativeBuildInputs = [ 
            pkgs.bun 
            pkgs.makeWrapper 
          ];

          buildPhase = ''
            export HOME="$TMPDIR"
            
            # Symlink the pre-fetched node_modules into our build directory
            ln -s ${forge-deps}/node_modules ./node_modules
            
            # Run the specific bun build command from your package.json
            bun run build
          '';

          installPhase = ''
            mkdir -p $out/share/forge $out/bin
            
            cp -r dist $out/share/forge/
            
            makeWrapper ${pkgs.bun}/bin/bun $out/bin/forge \
              --add-flags "$out/share/forge/dist/forge.js"
          '';

          meta = with pkgs.lib; {
            description = "Local-first AI coding agent powered by llama-server";
            mainProgram = "forge";
            platforms = platforms.all;
          };
        };
      in
      {
        packages.default = forge-pkg;
        packages.forge = forge-pkg;
      }
    ) // {
      overlays.default = final: prev: {
        forge = self.packages.${prev.system}.forge;
      };
    };
}