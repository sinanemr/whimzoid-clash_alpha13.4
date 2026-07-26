use strict; use warnings;
my $eng="js/engine.js";
open(my $fh,"<:raw",$eng) or die; my @L=<$fh>; close $fh;   # $L[n-1] = line n

# --- gather Haydar pieces (1-indexed) ---
my $contig = join("", @L[99..207]);            # 100-208: CHARS.push + IMG_SPRITES + SPRITES + ABILITIES (+comments)
my @ults   = @L[1326..1336];                   # 1327-1337: ULTS.haydar method
my @extras = @L[2424..2446];                   # 2425-2447: EXTRAS comment + haydar method
my $win    = $L[899];                          # 900: WIN_LINES.haydar

# ULTS method -> assignment
$ults[0]  =~ s/^\s*haydar\(f\)\{/ULTS.haydar=function(f){/;
$ults[-1] =~ s/\},(\s*)$/};$1/;                # final "}," -> "};"
my $ultsStr = join("", @ults);

# EXTRAS: keep the comment line [0], convert method line [1] and closer [-1]
$extras[1]  =~ s/^\s*haydar\(g,f,t\)\{/EXTRAS.haydar=function(g,f,t){/;
$extras[-1] =~ s/^(\s*)\},(\s*)$/$1};$2/;      # final " }," -> " };"
my $extrasStr = join("", @extras);

# WIN_LINES entry -> assignment
my $winStr = $win;
$winStr =~ s/^\s*haydar:(.*),(\s*)$/WIN_LINES.haydar=$1;$2/;

# --- write characters/haydar.js ---
my $hdr = <<'JS';
/**
 * HAYDAR PASHA — all of Haydar's editable data + behaviour in one file.
 * Loaded AFTER js/engine.js (see RUN_GAME.html), so the shared registries
 * (CHARS, IMG_SPRITES, SPRITES, ABILITIES, ULTS, EXTRAS, WIN_LINES) and the engine
 * helpers (meleeHit, applyStun, S, MZX, announce, other, particles, projectiles,
 * shake, statusFloat, shockExplosion, hitProps, ...) already exist as globals.
 * Rendering branches specific to Haydar (drawFighter poses) remain in engine.js.
 */
"use strict";
JS
open(my $o,">:raw","characters/haydar.js") or die;
print $o $hdr, "\n", $contig, "\n", $ultsStr, "\n", $extrasStr, "\n", $winStr;
close $o;

# --- remove the ranges from engine.js (bottom-up so indices stay valid) ---
splice(@L, 2424, 23);   # 2425-2447 EXTRAS (23 lines)
splice(@L, 1326, 11);   # 1327-1337 ULTS  (11 lines)
splice(@L, 899, 1);     # 900 WIN_LINES   (1 line)
splice(@L, 99, 109);    # 100-208 contiguous (109 lines)
open(my $e,">:raw",$eng) or die; print $e join("",@L); close $e;

print "haydar.js written\n";
print "engine.js now ", scalar(@L), " lines\n";
print "ULTS first entry now: ", $L[1326];
print "WIN_LINES first entry now: ", $L[899];
