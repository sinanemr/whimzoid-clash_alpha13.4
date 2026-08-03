/**
 * SATORI — all of this fighter's editable data + behaviour in one file.
 * Loaded AFTER js/engine.js, so the shared registries (CHARS, IMG_SPRITES, SPRITES,
 * ABILITIES, ULTS, EXTRAS, EXTRAS_BEHIND, WIN_LINES) and the engine helpers already exist.
 * Character-specific drawFighter render branches remain in engine.js.
 */
"use strict";


/* ==================== SATORI ==================== */
 CHARS.push({id:"satori", name:"Satori", ep:"The Crimson Blade",
  hp:500, armor:155, speed:172, jump:430, power:20,
  bio:"Fast hybrid combo fighter (double jump). NINJA AGILITY: finishing any basic combo — standing, aerial or crouching — grants +12% move & attack speed 2.5s. CRIMSON DISCIPLINE: alternating melee/ranged SKILLS prepares an empowered opposite-type skill (+10% dmg + bonus, 4s; basics don't trigger it).",
  ab:[
   {n:"CRIMSON PROJECTILES",cost:0,cd:8,kind:"ranged",d:"2 charges (4s window). Stand: 3×18 shuriken (all → STAGGER). Air: 5×10 diagonal spikes (4+ → SLOW). Crouch: 2×23 low (both → ROOT). Ranged Ready empowers."},
   {n:"CRIMSON BLADES",cost:0,cd:9,kind:"melee",d:"Stand: crossing dash 2×34, ignores 10% block. Air: crescent dive 65, sends DOWN. Crouch: low shadow crossing 2×30, ducks highs. Melee Ready empowers."},
   {n:"SPINAL SPIKES",cost:0,cd:11,kind:"ranged",d:"Stand: 4×18 spread, −15 block. Air: spine halo 66 + 35% DR. Crouch: floor TRAP 60 + STUN. Ranged/Melee Ready empowers."}
  ],
  ult:{n:"CRIMSON CATACLYSM",d:"4 giant spikes home in (4×18); first hit PARALYZES, then a katana execution (60) with HARD KNOCKDOWN + DEFENSE BREAK. Up to 142. Whiff all four → no execution."}
 });
 /* NEW ART: full 642x642 canvases with the character's feet at the canvas bottom and a consistent
    in-canvas scale, so every frame renders at the same size + feet line (w=h square keeps the aspect).
    3 idle frames sway for a natural stance. The rest of Satori's states are being re-added; until
    each sprite is in, that state falls back to idle (engine drawFighter guard). */
 IMG_SPRITES.satori={
 idle:{w:95,h:95,src:"assets/characters/satori/Satori-idle_01.png"},
 idle2:{w:95,h:95,src:"assets/characters/satori/Satori-idle_02.png"},
 idle3:{w:95,h:95,src:"assets/characters/satori/Satori-idle_03.png"},
 /* crouch is a one-way DOWN transition: crouch(01) -> crouch2(02) -> crouch3(03, settled hold) */
 crouch:{w:95,h:95,src:"assets/characters/satori/Satori_crouch_01.png"},
 crouch2:{w:95,h:95,src:"assets/characters/satori/Satori_crouch_02.png"},
 crouch3:{w:95,h:95,src:"assets/characters/satori/Satori_crouch_03.png"},
 /* jump = lift-off sequence jump(01)->jump2(02)->jump3(03, tucked apex); falling on the way down;
    dbljump = double-jump pose; landing = touchdown pose. */
 jump:{w:95,h:95,src:"assets/characters/satori/Satori_jump_01.png"},
 jump2:{w:95,h:95,src:"assets/characters/satori/Satori_jump_02.png"},
 jump3:{w:95,h:95,src:"assets/characters/satori/Satori_jump_03.png"},
 dbljump:{w:95,h:95,src:"assets/characters/satori/Satori_Doublejump.png"},
 falling:{w:95,h:95,src:"assets/characters/satori/Satori_falling.png"},
 landing:{w:95,h:95,src:"assets/characters/satori/Satori_landing.png"},
 /* dblfx1..4 = the double-jump energy burst — a STATIONARY effect at the take-off point (not a fighter frame) */
 dblfx1:{w:1,h:1,src:"assets/characters/satori/double-jump-energy_01.png"},
 dblfx2:{w:1,h:1,src:"assets/characters/satori/double-jump-energy_02.png"},
 dblfx3:{w:1,h:1,src:"assets/characters/satori/double-jump-energy_03.png"},
 dblfx4:{w:1,h:1,src:"assets/characters/satori/double-jump-energy_04.png"},
 /* 3-HIT BASIC COMBO: each hit is 2 frames (a=wind-up, b=strike). Hit 3 = HEAVY. */
 atk1a:{w:95,h:95,src:"assets/characters/satori/Satori_attack_01_1.png"},
 atk1b:{w:95,h:95,src:"assets/characters/satori/Satori_attack_01_2.png"},
 atk2a:{w:95,h:95,src:"assets/characters/satori/Satori_attack_02_1.png"},
 atk2b:{w:95,h:95,src:"assets/characters/satori/Satori_attack_02_2.png"},
 atk3a:{w:95,h:95,src:"assets/characters/satori/Satori_heavy-attack_01.png"},
 atk3b:{w:95,h:95,src:"assets/characters/satori/Satori_heavy-attack_02.png"},
 /* CROUCH 3-hit combo (hold crouch + attack): same 3 hits x 2 frames, crouched variants. */
 catk1a:{w:95,h:95,src:"assets/characters/satori/Satori_crouch_attack_01_1.png"},
 catk1b:{w:95,h:95,src:"assets/characters/satori/Satori_crouch_attack_01_02.png"},
 catk2a:{w:95,h:95,src:"assets/characters/satori/Satori_crouch_attack_02_1.png"},
 catk2b:{w:95,h:95,src:"assets/characters/satori/Satori_crouch_attack_02_2.png"},
 catk3a:{w:95,h:95,src:"assets/characters/satori/Satori_crouch_attack_03_1.png"},
 catk3b:{w:95,h:95,src:"assets/characters/satori/Satori_crouch_attack_03_2.png"},
 /* AIR basic attack: a single move, 3-frame sequence (airborne). */
 airatk1:{w:95,h:95,src:"assets/characters/satori/Satori-air-attack_01.png"},
 airatk2:{w:95,h:95,src:"assets/characters/satori/Satori-air-attack_02.png"},
 airatk3:{w:95,h:95,src:"assets/characters/satori/Satori-air-attack_03.png"},
 /* KO (DEFEAT only): ko = impact, ko2 = lying grounded. */
 ko:{w:95,h:95,src:"assets/characters/satori/Satori_KO_01.png"},
 ko2:{w:95,h:95,src:"assets/characters/satori/Satori_KO_02.png"},
 /* KNOCKBACK sequence (knocked DOWN, not defeated): kb1 = flying/hit, kb2 = grounded down, kb3 = getting up. */
 kb1:{w:95,h:95,src:"assets/characters/satori/Satori-knockback_01.png"},
 kb2:{w:95,h:95,src:"assets/characters/satori/Satori-knockback_02.png"},
 kb3:{w:95,h:95,src:"assets/characters/satori/Satori-knockback_03.png"}
};
 SPRITES.satori={pal:{p:"#2b4fd8",P:"#1c3798",c:"#c8d2e6",a:"#e2384a",s:"#e8c39a",e:"#141420",k:"#10142e"},g:[
"......pppp......",
".....pppppp.....",
".....ppppppaa...",
".....pssssp.....",
".....pessep.....",
".....pssssp.....",
".....pppppp.....",
"......pppp......",
".......pp.......",
"...pppppppppp...",
"..ppppccccpppp..",
"..pppccccccppp..",
"..pppccccccppp..",
"..pPppccccppPp..",
"..s.pppppppp.s..",
"....pppppppp....",
"....pppppppp....",
"....pppppppp....",
"....aaaaaaaa....",
"....pppppppp....",
".....ppp.ppp....",
".....ppp.ppp....",
".....ppp.ppp....",
".....ppp.ppp....",
".....PPP.PPP....",
".....PPP.PPP....",
".....kkk.kkk....",
".....kkk.kkk....",
"....kkkk.kkkk...",
]};
 ABILITIES.satori=[
  f=>{f.state="special";f.t=0;announce("CRIMSON SHURIKEN!",600);
   const emp=useDiscipline(f,"ranged");
   f._shurVolley++;f._shurHits=0;
   const dmgs=emp?[24,23,23]:[20,20,20];
   [0,120,240].forEach((d,i)=>setTimeout(()=>{if(!running)return;
    projectiles.push({type:"shurimg",x:MZX(f,16),y:f.centerY-S(8)+S(i*5),vx:f.facing*400,vy:rand(-10,10),r:6,dmg:dmgs[i],owner:f,col:"#ff4a5a",skill:true,volley:f._shurVolley});},d));},
  f=>{f.state="special";f.t=0;announce("TWIN CRIMSON BLADES!",650);
   const emp=useDiscipline(f,"melee");
   meleeHit(f,{range:S(52),dmg:emp?80:70,kb:260,opts:{skill:true,col:"#e2384a",fx:"#ff8fa0"},onHit:foe=>{
    foe.bleedDps=10;foe.bleed=Math.max(foe.bleed,2);statusFloat(foe,"CRIMSON BURN","#ff5e6e");}});},
  f=>{f.state="special";f.t=0;announce("SPINAL SPIKE BURST!",650);
   const emp=useDiscipline(f,"melee");
   f._spikeDmg=emp?75:65;
   f.dashT=.14;f.dashDir=f.facing;f.dashHit=false;f.dashKind="satori";
   f.dr10T=1.5;statusFloat(f,"HARDENED","#e2384a");}];

ULTS.satori=function(f){announce("CRIMSON SPIKE TEMPEST",1200);f.state="special";f.t=0;
  f.ultPose=1.7;f._ultHalf=0.85;
  for(let i=0;i<6;i++)setTimeout(()=>{if(!running)return;
   projectiles.push({type:"spikeimg",x:MZX(f,20),y:f.centerY-S(10)+S(rand(-8,10)),vx:f.facing*(380+i*15),vy:rand(-12,12),r:6,dmg:10,owner:f,col:"#e2384a",skill:true});},i*115);
  setTimeout(()=>{if(!running||!f.alive)return;
   announce("CROSSING STRIKE!",700);shake=Math.max(shake,.6);
   f.dashT=.18;f.dashDir=f.facing;f.dashHit=false;f.dashKind="tempest";},850);
  setTimeout(()=>{if(!running||!f.alive)return;
   f.momT=4;f.momBonusT=4;statusFloat(f,"NINJA MOMENTUM","#ff5e6e");},1150);};
WIN_LINES.satori="“Master Akira taught me: strike once, strike true. The crimson spike never misses twice.”";

