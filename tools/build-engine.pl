use strict; use warnings;
use MIME::Base64 qw(decode_base64);
use Digest::MD5 qw(md5_hex);
use File::Find;

# Builds js/engine.js from the 13.1 <script> body:
#  - replaces every base64 data-URI with the matching extracted asset path
#  - externalises config / controls / on-screen key labels to the new modules
my $SRC  = "C:/Users/semre/Documents/Mincik Game/whimzoid-clash_alpha13.1.html";
my $ROOT = "C:/Users/semre/Documents/Mincik Game/whimzoid-clash-refactored";

# --- md5(asset bytes) -> "assets/..." relative path ---
my %byMd5;
find(sub{ return unless -f && /\.png$/i; local $/; open(my $f,"<:raw",$File::Find::name)or die; my $d=<$f>; close $f;
  (my $rel=$File::Find::name)=~s{^\Q$ROOT\E/}{}; $byMd5{md5_hex($d)}=$rel; }, "$ROOT/assets");
print "asset md5 map: ",scalar(keys %byMd5)," entries\n";

# --- pull the <script> body (lines 190..4029, i.e. between <script> and </script>) ---
open(my $fh,"<:raw",$SRC) or die; my @lines=<$fh>; close $fh;
my $body = join("", @lines[189..4028]);   # 0-indexed

# --- base64 -> asset path ---
my $miss=0; my $repl=0;
$body =~ s{data:image/png;base64,([A-Za-z0-9+/=]+)}{
  my $b64=$1; my $m=md5_hex(decode_base64($b64));
  if(exists $byMd5{$m}){ $repl++; $byMd5{$m}; } else { $miss++; "MISSING_ASSET"; }
}ge;
die "ERROR: $miss base64 blobs had no matching asset\n" if $miss;
print "base64 -> path replacements: $repl (missing=$miss)\n";

# --- externalise config / controls / labels (literal, exact-match, count each) ---
my @subs = (
 ['const W=720, H=270, GROUND=249, GRAV=1200;',
  'const W=CFG.viewport.width, H=CFG.viewport.height, GROUND=CFG.world.ground, GRAV=CFG.world.gravity;'],
 ['const CH_SCALE=0.72;', 'const CH_SCALE=CFG.fighters.scale;'],
 ['const WORLD_W=2032;', 'const WORLD_W=CFG.world.width;'],
 ['const WALL_L=652, WALL_R=1638;', 'const WALL_L=CFG.world.leftWall, WALL_R=CFG.world.rightWall;'],
 ['const SPAWN_1=900, SPAWN_2=1180;', 'const SPAWN_1=CFG.fighters.player1Spawn, SPAWN_2=CFG.fighters.player2Spawn;'],
 ['const RENDER_SCALE=2;', 'const RENDER_SCALE=CFG.viewport.renderScale;'],
 ['cv.width=W*RENDER_SCALE; cv.height=H*RENDER_SCALE;', 'applyViewport(cv);'],
 ['const P1KEYS={left:"arrowleft",right:"arrowright",jump:" ",block:"arrowup",crouch:"arrowdown",atk:"d",ab:["q","w","e"],ult:"r"};',
  "const P1KEYS=ENGINE_KEYS('p1');"],
 ['const P2KEYS={left:"arrowleft",right:"arrowright",jump:"arrowup",block:"i",crouch:"arrowdown",atk:"k",ab:["l","o","p"],ult:"m"};',
  "const P2KEYS=ENGINE_KEYS('p2');"],
 ['const AB_LABELS={p1:["Q","W","E"],p2:["L","O","P"],cpu:["L","O","P"]};',
  "const AB_LABELS={p1:ABIL_LABELS('p1'),p2:ABIL_LABELS('p2'),cpu:ABIL_LABELS('p2')};"],
 ['const ULT_KEY={p1:"R",p2:"M",cpu:"M"};',
  "const ULT_KEY={p1:ULT_LABEL('p1'),p2:ULT_LABEL('p2'),cpu:ULT_LABEL('p2')};"],
 ['this.meter=Math.min(100,this.meter+n);', 'this.meter=Math.min(CFG.match.maximumEnergy,this.meter+n);'],
 ['if(winner.wins>=2)', 'if(winner.wins>=CFG.match.winsRequired)'],
 ['*Math.min(1,dt*4.5)', '*Math.min(1,dt*CFG.camera.followSpeed)'],
 ['AB_LABELS.p1,"R"', 'AB_LABELS.p1,ULT_KEY.p1'],
 ['AB_LABELS.p2,"M"', 'AB_LABELS.p2,ULT_KEY.p2'],
);
for my $s (@subs){ my ($from,$to)=@$s; my $n=0; $n++ while $body =~ s/\Q$from\E/$to/;
  printf "  %-42s x%d\n", (length($from)>42?substr($from,0,39)."...":$from), $n;
  warn "  !! NOT FOUND: $from\n" if $n==0; }

# roundTime: 'timer=60' appears in the state decl and the round reset
my $tn=0; $tn++ while $body =~ s/\btimer=60\b/timer=CFG.match.roundTime/; print "  timer=60 x$tn\n";

# --- module header (imports) ---
my $header = <<'JS';
/**
 * WHIMZOID CLASH — game engine (migrated verbatim from whimzoid-clash_alpha13.1.html).
 *
 * Loaded as a CLASSIC script (not an ES module) by js/main.js, on purpose: the
 * original 4000-line script runs in sloppy mode, and forcing it into a strict ES
 * module could change behaviour. js/main.js imports the config/controls modules
 * and exposes their values as globals BEFORE loading this file, so the identifiers
 * below resolve normally:
 *   CFG          = GAME_CONFIG        (js/config.js)
 *   applyViewport= applyViewport      (js/config.js)
 *   ENGINE_KEYS  = toEngineKeys       (js/controls.js)
 *   ABIL_LABELS  = abilityLabels      (js/controls.js)
 *   ULT_LABEL    = ultimateLabel      (js/controls.js)
 *
 * Edits vs. the original <script>:
 *   - every embedded base64 sprite/stage image is now an ./assets/... file path
 *   - config constants (W,H,GROUND,GRAV,CH_SCALE,WORLD_W,WALL_L/R,SPAWN_1/2,
 *     RENDER_SCALE, round time, wins, energy cap, camera follow) come from CFG
 *   - P1KEYS/P2KEYS and on-screen key labels (AB_LABELS/ULT_KEY) come from controls
 *     -> Player 1 now uses the new A/D/Space/U/S/I/J/K/L/O scheme automatically.
 *
 * (Option-1 refactor: character data + bespoke mechanics still live here for now;
 * being peeled into /characters incrementally so each step stays playtestable.)
 */

JS

open(my $o,">:raw","$ROOT/js/engine.js") or die;
print $o $header, $body;
close $o;
my $kb=int((-s "$ROOT/js/engine.js")/1024);
print "WROTE js/engine.js  (${kb} KB, ",scalar(split /\n/,$body)," body lines)\n";
