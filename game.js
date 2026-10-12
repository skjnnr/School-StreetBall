import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const host=document.getElementById("game");
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x080b11);
scene.fog=new THREE.Fog(0x080b11,45,100);

const camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,200);
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
host.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff,0x25304a,2.2));
const sun=new THREE.DirectionalLight(0xffffff,3.2);
sun.position.set(-8,18,12); sun.castShadow=true; scene.add(sun);

const court=new THREE.Mesh(new THREE.PlaneGeometry(30,28),new THREE.MeshStandardMaterial({color:0xc89452,roughness:.7}));
court.rotation.x=-Math.PI/2; court.receiveShadow=true; scene.add(court);

function line(points,closed=false){
  const pts=points.map(p=>new THREE.Vector3(p[0],.025,p[1]));
  if(closed) pts.push(pts[0].clone());
  const g=new THREE.BufferGeometry().setFromPoints(pts);
  const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xf5f5f5}));
  scene.add(l); return l;
}
line([[-15,-14],[15,-14],[15,14],[-15,14]],true);
line([[-8,14],[-8,8],[8,8],[8,14]],false);
const arc=[]; for(let i=0;i<=48;i++){let a=Math.PI+(Math.PI*i/48);arc.push([12*Math.cos(a),11.2+12*Math.sin(a)]);}
line(arc);
line([[-12,14],[-12,11.2]]); line([[12,14],[12,11.2]]);

const hoopZ=11.8, rimY=3.05;
const pole=new THREE.Mesh(new THREE.BoxGeometry(.35,4,.35),new THREE.MeshStandardMaterial({color:0x333842}));
pole.position.set(0,2,13.2); pole.castShadow=true; scene.add(pole);
const board=new THREE.Mesh(new THREE.BoxGeometry(6,3,.18),new THREE.MeshStandardMaterial({color:0xe7edf4,transparent:true,opacity:.88}));
board.position.set(0,4.25,12.65); board.castShadow=true; scene.add(board);
const rim=new THREE.Mesh(new THREE.TorusGeometry(.46,.055,12,32),new THREE.MeshStandardMaterial({color:0xf05a24}));
rim.rotation.x=Math.PI/2; rim.position.set(0,rimY,hoopZ); scene.add(rim);
const net=new THREE.Mesh(new THREE.CylinderGeometry(.44,.28,.75,16,1,true),new THREE.MeshBasicMaterial({color:0xffffff,wireframe:true,transparent:true,opacity:.5}));
net.position.set(0,rimY-.4,hoopZ); scene.add(net);

function makePlayer(color){
  const g=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color});
  const skin=new THREE.MeshStandardMaterial({color:0xb97745});
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.42,1.05,6,10),mat); body.position.y=1.15; body.castShadow=true; g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.32,16,12),skin); head.position.y=2.22; head.castShadow=true; g.add(head);
  const leg1=new THREE.Mesh(new THREE.CapsuleGeometry(.14,.7,4,8),mat); leg1.position.set(-.22,.35,0); g.add(leg1);
  const leg2=leg1.clone(); leg2.position.x=.22; g.add(leg2);
  const arm1=new THREE.Mesh(new THREE.CapsuleGeometry(.11,.72,4,8),skin); arm1.position.set(-.52,1.35,0); arm1.rotation.z=-.15; g.add(arm1);
  const arm2=arm1.clone(); arm2.position.x=.52; arm2.rotation.z=.15; g.add(arm2);
  return g;
}
const player=makePlayer(0x246bdb); player.position.set(0,0,-5); scene.add(player);
const cpu=makePlayer(0xd63d3d); cpu.position.set(0,0,0); scene.add(cpu);

const ball=new THREE.Mesh(new THREE.SphereGeometry(.24,20,16),new THREE.MeshStandardMaterial({color:0xd66a22,roughness:.8}));
ball.castShadow=true; scene.add(ball);

const keys={}; let started=false,shooting=false,charge=0,ballFlight=false,vel=new THREE.Vector3(),score=0,lastDribble=0,moveLock=0,hand=1,shotCanScore=false;
const meter=document.getElementById("meter"),fill=document.getElementById("meterFill"),feedback=document.getElementById("feedback");

document.getElementById("play").onclick=()=>{started=true;document.getElementById("start").style.display="none";};
addEventListener("keydown",e=>{
  if(["Tab","Space"].includes(e.code)) e.preventDefault();
  keys[e.code]=true;
  if(!started||ballFlight) return;
  if(e.code==="KeyE") skill("CROSSOVER",-.9);
  if(e.code==="KeyQ") skill("BEHIND BACK",1.1);
  if(e.code==="Tab") skill("BETWEEN LEGS",-.65);
  if(e.code==="KeyR") skill("HESITATION",.55);
  if(e.code==="KeyF"&&!shooting){shooting=true;charge=0;meter.style.display="block";}
});
addEventListener("keyup",e=>{
  keys[e.code]=false;
  if(e.code==="KeyF"&&shooting){shooting=false;releaseShot();}
});

function skill(name,side){
  const now=performance.now(); if(now-lastDribble<330)return; lastDribble=now;
  feedback.textContent=name; hand*=-1; moveLock=.2;
  player.position.x=THREE.MathUtils.clamp(player.position.x+side,-13.5,13.5);
  // CPU can be beaten by moves, but never affects shot calculations.
  if(Math.random()<.58){cpu.position.x-=side*.9; feedback.textContent=name+"! BEAT HIM";}
  setTimeout(()=>{if(!shooting)feedback.textContent="";},550);
}
function releaseShot(){
  meter.style.display="none";
  const pct=charge%1;
  const dist=Math.hypot(player.position.x,hoopZ-player.position.z);
  const ideal=THREE.MathUtils.clamp(.76 + (dist-4)*.008,.73,.84);
  const error=Math.abs(pct-ideal);
  const green=error<.045;
  const makeChance=green?1:Math.max(.18,.82-error*2.4-dist*.012);
  const made=Math.random()<makeChance;
  feedback.textContent=green?"GREEN!":pct<ideal?"EARLY":"LATE";
  if(green) feedback.textContent+=" ✓";
  const start=ball.position.clone();
  const target=new THREE.Vector3(0,rimY+.08,hoopZ);
  const d=target.clone().sub(start);
  const t=1.05+dist*.025;
  vel.set(d.x/t,(d.y+4.9*t*t)/t,d.z/t);
  if(!made) vel.x += (Math.random()-.5)*1.25, vel.z += (Math.random()-.5)*.7;
  ballFlight=true; shotCanScore=made;
  setTimeout(()=>{if(ballFlight)resetPossession();},3300);
}
function resetPossession(){
  ballFlight=false; shotCanScore=false; player.position.set((Math.random()-.5)*4,0,-5.5); cpu.position.set(0,0,-.4); feedback.textContent="CHECK BALL";
}
function updateBall(dt,time){
  if(ballFlight){
    const prevY=ball.position.y;
    vel.y-=9.8*dt; ball.position.addScaledVector(vel,dt);
    if(shotCanScore && prevY>rimY && ball.position.y<=rimY && Math.hypot(ball.position.x,ball.position.z-hoopZ)<.43){
      shotCanScore=false;
      const dist=Math.hypot(player.position.x,hoopZ-player.position.z);
      const pts=dist>7.25?3:2; score+=pts; document.getElementById("playerScore").textContent=score;
      feedback.textContent=`+${pts} BUCKET`;
      setTimeout(resetPossession,900);
    }
    if(ball.position.y<.24){ball.position.y=.24;vel.y=Math.abs(vel.y)*.58;vel.x*=.82;vel.z*=.82;}
  }else{
    const bounce=Math.abs(Math.sin(time*8))*1.05;
    const side=.52*hand;
    ball.position.set(player.position.x+side,.28+bounce,player.position.z+.08);
  }
}
function updatePlayer(dt){
  if(moveLock>0)moveLock-=dt;
  let x=(keys.KeyA?1:0)-(keys.KeyD?1:0),z=(keys.KeyW?1:0)-(keys.KeyS?1:0);
  const len=Math.hypot(x,z); if(len){x/=len;z/=len;}
  const speed=keys.ShiftLeft||keys.ShiftRight?7.1:5.0;
  player.position.x=THREE.MathUtils.clamp(player.position.x+x*speed*dt,-13.6,13.6);
  player.position.z=THREE.MathUtils.clamp(player.position.z+z*speed*dt,-12.8,10.4);
  if(len) player.rotation.y=Math.atan2(x,z);
}
function updateCPU(dt){
  // Defender shades the lane and mirrors movement. It NEVER enters shooting math.
  const basket=new THREE.Vector3(0,0,hoopZ);
  const toward=basket.clone().sub(player.position).setY(0).normalize();
  const desired=player.position.clone().add(toward.multiplyScalar(1.7));
  desired.x=THREE.MathUtils.clamp(desired.x,-12.8,12.8);
  desired.z=THREE.MathUtils.clamp(desired.z,-10.5,10.5);
  const delta=desired.sub(cpu.position); const d=delta.length();
  if(d>.08) cpu.position.addScaledVector(delta.normalize(),Math.min(4.15*dt,d));
  cpu.lookAt(player.position.x,cpu.position.y,player.position.z);
}
function updateCamera(dt){
  // Elevated trailing/broadcast hybrid inspired by modern basketball games.
  const toHoop=new THREE.Vector3(0,0,hoopZ).sub(player.position).setY(0).normalize();
  const side=new THREE.Vector3(toHoop.z,0,-toHoop.x);
  const desired=player.position.clone().addScaledVector(toHoop,-8.2).addScaledVector(side,1.2);
  desired.y=7.1;
  camera.position.lerp(desired,1-Math.pow(.002,dt));
  const look=player.position.clone().addScaledVector(toHoop,2.7); look.y=1.2;
  camera.lookAt(look);
}
const clock=new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.033),time=performance.now()/1000;
  if(started){
    updatePlayer(dt); updateCPU(dt); updateBall(dt,time); updateCamera(dt);
    if(shooting){charge+=dt*1.75;const pct=(charge%1);fill.style.width=(pct*100)+"%";}
  }else updateCamera(dt);
  renderer.render(scene,camera);
}
animate();
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
