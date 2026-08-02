use strict; use warnings;
use MIME::Base64 qw(decode_base64);
use Digest::MD5 qw(md5_hex);

# Extracts every embedded base64 image from the source game into assets/ files,
# de-duplicates identical blobs, and writes a JSON manifest describing each state.
my $SRC  = "C:/Users/semre/Documents/Mincik Game/what-just-hit-me_alpha13.1.html";
my $ROOT = "C:/Users/semre/Documents/Mincik Game/what-just-hit-me-refactored";

my %CHARFOLDER = (notalk=>"no-talking-man", ember=>"emberstrike");  # id -> asset folder (else = id)

open(my $fh, "<:raw", $SRC) or die "open $SRC: $!";
my @lines = <$fh>; close $fh;

my %seen;        # md5 -> relative path already written (dedup)
my %manifest;    # container => { state => {file,w,h,dx,foot} }
my $written = 0; my $reused = 0;

sub emit {
  my ($relpath, $b64) = @_;
  my $data = decode_base64($b64);
  my $md5  = md5_hex($data);
  if (exists $seen{$md5}) { $reused++; return $seen{$md5}; }
  my $abs = "$ROOT/$relpath";
  (my $dir = $abs) =~ s{/[^/]+$}{};
  system("mkdir","-p",$dir)==0 or `mkdir -p "$dir"`;
  open(my $o, ">:raw", $abs) or die "write $abs: $!";
  print $o $data; close $o;
  die "BAD PNG magic for $relpath\n" unless substr($data,0,4) eq "\x89PNG";
  $seen{$md5} = $relpath; $written++;
  return $relpath;
}

my $ctx = "";   # current container: "char:<id>" | "PROJ" | "FX" | ""
for my $ln (@lines) {
  # --- container starts (check before matching states on the same line) ---
  if ($ln =~ /IMG_SPRITES\.(\w+)\s*=\s*\{/) { $ctx = "char:$1"; }
  elsif ($ln =~ /const\s+PROJ_IMGS\s*=\s*\{/) { $ctx = "PROJ"; }
  elsif ($ln =~ /const\s+FX_IMGS\s*=\s*\{/)   { $ctx = "FX"; }
  elsif ($ln =~ /^\};?\s*$/) { $ctx = ""; }

  # --- STAGE_BG (its own statement) ---
  if ($ln =~ /STAGE_BG\.src\s*=\s*"(data:image\/png;base64,([^"]+))"/) {
    my $rel = emit("assets/stages/kabatepe/background.png", $2);
    $manifest{stage}{background} = { file=>$rel };
  }

  next unless $ctx;
  # --- state entries: NAME:{w:..,h:..[,dx:..][,foot:..],src:"data:..."} (0+ per line) ---
  while ($ln =~ /([A-Za-z0-9_]+):\{w:(\d+),h:(\d+)((?:,(?:dx|foot):-?\d+)*),src:"data:image\/png;base64,([^"]+)"/g) {
    my ($name,$w,$h,$attrs,$b64) = ($1,$2,$3,$4,$5);
    my ($dx) = $attrs =~ /dx:(-?\d+)/;  my ($foot) = $attrs =~ /foot:(-?\d+)/;
    my ($container,$folder,$rel);
    if ($ctx =~ /^char:(\w+)$/) {
      my $id=$1; $folder = $CHARFOLDER{$id} // $id; $container="char:$id";
      $rel = emit("assets/characters/$folder/$name.png", $b64);
    } elsif ($ctx eq "PROJ") {
      $container="projectiles"; $rel = emit("assets/projectiles/$name.png", $b64);
    } elsif ($ctx eq "FX") {
      $container="fx"; $rel = emit("assets/effects/$name.png", $b64);
    }
    my %e = (file=>$rel, w=>$w+0, h=>$h+0);
    $e{dx}=$dx+0 if defined $dx; $e{foot}=$foot+0 if defined $foot;
    $manifest{$container}{$name} = \%e;
  }
}

# --- write manifest as JSON (hand-rolled, stable) ---
sub jesc { my $s=shift; $s=~s/(["\\])/\\$1/g; return $s; }
sub obj {
  my ($h,$ind)=@_; my $pad="  "x$ind; my $pad2="  "x($ind+1);
  my @k=sort keys %$h; return "{}" unless @k;
  my @parts;
  for my $k (@k){ my $v=$h->{$k};
    my $val = ref($v) eq 'HASH' ? obj($v,$ind+1)
            : ($v=~/^-?\d+$/ ? $v : '"'.jesc($v).'"');
    push @parts, "$pad2\"".jesc($k)."\": $val";
  }
  return "{\n".join(",\n",@parts)."\n$pad}";
}
open(my $mo, ">:raw", "$ROOT/tools/asset-manifest.json") or die;
print $mo obj(\%manifest,0),"\n"; close $mo;

my $states=0; $states+=scalar keys %{$manifest{$_}} for keys %manifest;
print "written=$written reused(dedup)=$reused  containers=",scalar(keys %manifest),"  total-states=$states\n";
print "  $_ : ",scalar(keys %{$manifest{$_}})," states\n" for sort keys %manifest;
