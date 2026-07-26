use strict; use warnings;
# Peels one character out of js/engine.js into characters/<file>.js
# Usage: perl tools/peel-char.pl <id> <NAME> <outfile.js>
my ($id,$NAME,$out)=@ARGV;
die "usage: peel-char.pl <id> <NAME> <outfile>\n" unless $id && $NAME && $out;
my $eng="js/engine.js";
open(my $fh,"<:raw",$eng) or die; my @L=<$fh>; close $fh;   # $L[i] = line i+1

sub findidx { my($re,$s)=@_; $s//=0; for(my $i=$s;$i<@L;$i++){return $i if $L[$i]=~$re;} return -1; }

my @removed;   # list of [start,end] index ranges to delete from engine
my @parts;     # ordered text chunks for the char file

# ---- 1. contiguous CHARS.push + IMG_SPRITES + SPRITES + ABILITIES ----
my $push=findidx(qr/CHARS\.push\(\{id:"\Q$id\E"/);
die "no CHARS.push for $id\n" if $push<0;
my $bs=$push;
$bs-- while $bs>0 && ($L[$bs-1]=~/^\s*$/ || $L[$bs-1]=~/^\s*\/\* ={3,}/);
my $preload=findidx(qr/^for\(const id in IMG_SPRITES\)/);
my $nextDiv=findidx(qr/^\s*\/\* ={3,}/,$push+1);
my $be = ($nextDiv>=0 && $nextDiv<$preload) ? $nextDiv-1 : $preload-1;
$be-- while $be>$push && $L[$be]=~/^\s*$/;
push @parts, join("",@L[$bs..$be]);
push @removed, [$bs,$be];
print "contiguous: lines ",($bs+1),"-",($be+1),"\n";

# ---- method extractor (ULTS / EXTRAS / EXTRAS_BEHIND) ----
sub extract_method {
  my ($reg,$declRe,$stopRe,$sig)=@_;   # sig: 'f' or 'g,f,t'
  my $decl=findidx($declRe); return unless $decl>=0;
  my $stop=findidx($stopRe,$decl+1); $stop=@L if $stop<0;
  my $m=findidx(qr/^ \Q$id\E\(\Q$sig\E\)\{/,$decl+1);
  return if $m<0 || $m>=$stop;
  my $s=$m; $s-- while $s>0 && $L[$s-1]=~/^\s*\/\*.*\*\/\s*$/;   # preceding 1-line comment(s)
  my $e=$m;
  for(my $i=$m+1;$i<@L;$i++){ if($L[$i]=~/^ [a-z]\w*\(/ || $L[$i]=~/^\};/){ $e=$i-1; last; } }
  my @mm=@L[$s..$e];
  for my $ln (@mm){ if($ln=~s/^(\s*)\Q$id\E(\([^)]*\)\s*\{)/$reg.$id=function$2/){ last; } }   # substitute PREFIX only (preserve inline body)
  $mm[-1]=~s/\}(,?)\s*$/};/;
  push @parts, join("",@mm);
  push @removed, [$s,$e];
  print "$reg.$id: lines ",($s+1),"-",($e+1),"\n";
}
extract_method("ULTS",         qr/^const ULTS=\{/,          qr/^\};/, "f");
extract_method("EXTRAS",       qr/^const EXTRAS=\{/,        qr/^const EXTRAS_BEHIND=\{/, "g,f,t");
extract_method("EXTRAS_BEHIND",qr/^const EXTRAS_BEHIND=\{/, qr/^\};/, "g,f,t");

# ---- WIN_LINES ----
my $wl=findidx(qr/^ \Q$id\E:"/);
if($wl>=0){ my $line=$L[$wl]; $line=~s/^\s*\Q$id\E:(.*),\s*$/WIN_LINES.$id=$1;/;
  push @parts, "$line\n"; push @removed, [$wl,$wl]; print "WIN_LINES.$id: line ",($wl+1),"\n"; }

# ---- write char file ----
my $hdr="/**\n * $NAME — all of this fighter's editable data + behaviour in one file.\n"
 ." * Loaded AFTER js/engine.js, so the shared registries (CHARS, IMG_SPRITES, SPRITES,\n"
 ." * ABILITIES, ULTS, EXTRAS, EXTRAS_BEHIND, WIN_LINES) and the engine helpers already exist.\n"
 ." * Character-specific drawFighter render branches remain in engine.js.\n */\n\"use strict\";\n";
open(my $o,">:raw","characters/$out") or die;
print $o $hdr, "\n", join("\n",@parts), "\n";
close $o;

# ---- remove from engine (descending start so indices stay valid) ----
for my $r (sort { $b->[0] <=> $a->[0] } @removed){ splice(@L,$r->[0], $r->[1]-$r->[0]+1); }
open(my $e,">:raw",$eng) or die; print $e join("",@L); close $e;
print "-> characters/$out written; engine.js now ",scalar(@L)," lines\n";
