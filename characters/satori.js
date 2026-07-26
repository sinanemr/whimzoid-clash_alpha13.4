/**
 * SATORI — all of this fighter's editable data + behaviour in one file.
 * Loaded AFTER js/engine.js, so the shared registries (CHARS, IMG_SPRITES, SPRITES,
 * ABILITIES, ULTS, EXTRAS, EXTRAS_BEHIND, WIN_LINES) and the engine helpers already exist.
 * Character-specific drawFighter render branches remain in engine.js.
 */
"use strict";


/* ==================== SATORI ==================== */
 CHARS.push({id:"satori", name:"Satori", ep:"The Crimson Spike",
  hp:485, armor:150, speed:165, jump:430, power:30,
  bio:"Agile hybrid, double jump. Ninja Reflexes: -10% ranged damage. Crimson Discipline: alternating melee/ranged skills empowers the next by +10 (4s); repeating wastes it.",
  ab:[
   {n:"CRIMSON SHURIKEN",cost:0,cd:8,kind:"ranged",d:"Three shuriken: 3×20 (70 empowered). All three hit: STUN 0.4s."},
   {n:"TWIN CRIMSON BLADES",cost:0,cd:9,kind:"melee",d:"Crossing slash: 70 dmg (80 empowered) + burn 10/s 2s, heavy knockback."},
   {n:"SPINAL SPIKE BURST",cost:0,cd:11,kind:"melee",d:"Dash ending behind foe: 65 dmg (75 empowered). -10% damage taken 1.5s."}
  ],
  ult:{n:"CRIMSON SPIKE TEMPEST",d:"Spike barrage + blade finish: up to 115 dmg, DEFENSE BREAK 15% 4s, burn 10/s. Then -15% ranged taken 4s + next skill empowered."}
 });
 IMG_SPRITES.satori={
 idle:{w:49,h:72,src:"assets/characters/satori/idle.png"},
 hit:{w:55,h:71,src:"assets/characters/satori/hit.png"},
 attack:{w:66,h:72,src:"assets/characters/satori/attack.png"},
 attack2:{w:68,h:72,src:"assets/characters/satori/attack2.png"},
 skillA:{w:84,h:76,src:"assets/characters/satori/skillA.png"},
 skillB:{w:114,h:78,src:"assets/characters/satori/skillB.png"},
 skillC:{w:118,h:74,src:"assets/characters/satori/skillC.png"},
 block:{w:81,h:67,src:"assets/characters/satori/block.png"},
 crouch:{w:57,h:54,src:"assets/characters/satori/crouch.png"},
 jump:{w:54,h:74,src:"assets/characters/satori/jump.png"},
 ko:{w:92,h:34,src:"assets/characters/satori/ko.png"},
 ult1:{w:97,h:85,src:"assets/characters/satori/ult1.png"},
 ult2:{w:102,h:80,src:"assets/characters/satori/ult2.png"},
 run0:{w:57,h:72,src:"assets/characters/satori/run0.png"},
 run1:{w:58,h:72,dx:-6,src:"assets/characters/satori/run1.png"}
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

