import { useState, useEffect, useRef, useCallback } from "react";

/* ═══ DESIGN TOKENS ═══ */
const T = {
  bg: "#060a10", surface: "#0c1018", surface2: "#111822",
  border: "#1a2436", border2: "#243048",
  green: "#22d97a", greenDim: "#22d97a30", greenGlow: "#22d97a18",
  orange: "#f0803c", orangeDim: "#f0803c30",
  blue: "#4da6ff", blueDim: "#4da6ff20",
  cyan: "#22d3ee", cyanDim: "#22d3ee25",
  red: "#ef4444", white: "#eaf0f6", gray: "#6b7a90", grayDim: "#3a4860",
  purple: "#b48eff", purpleDim: "#b48eff20",
};
const F = "'IBM Plex Mono','SF Mono',monospace";
const FS = "'DM Sans',system-ui,sans-serif";

/* ═══ HELPERS ═══ */
const toBin = (n, b = 4) => Array.from({ length: b }, (_, i) => (n >> (b - 1 - i)) & 1);

function fullAdder(a, b, cin) {
  const xor1 = a ^ b, sum = xor1 ^ cin, and1 = a & b, and2 = xor1 & cin;
  return { sum, carry: and1 | and2, xor1, and1, and2 };
}

function claCompute(bitsA, bitsB) {
  const G = [], P = [], C = [0], S = [];
  for (let i = 3; i >= 0; i--) { G[i] = bitsA[i] & bitsB[i]; P[i] = bitsA[i] ^ bitsB[i]; }
  // C[i] = carry INTO bit i (C[4]=carry into bit3=0, C[0]=final carry out)
  // Lookahead: all computed simultaneously from G, P, C_in=0
  C[4] = 0; // carry into LSB
  C[3] = G[3] | (P[3] & C[4]);
  C[2] = G[2] | (P[2] & G[3]) | (P[2] & P[3] & C[4]);
  C[1] = G[1] | (P[1] & G[2]) | (P[1] & P[2] & G[3]) | (P[1] & P[2] & P[3] & C[4]);
  C[0] = G[0] | (P[0] & G[1]) | (P[0] & P[1] & G[2]) | (P[0] & P[1] & P[2] & G[3]) | (P[0] & P[1] & P[2] & P[3] & C[4]);
  for (let i = 0; i < 4; i++) S[i] = P[i] ^ C[i + 1];
  return { G, P, C, S };
}

/* ═══ SVG PRIMITIVES ═══ */
const GW = 54, GH = 34;

function Gate({ x, y, label, active, color = T.green, w = GW, h = GH }) {
  return <g>
    <rect x={x} y={y} width={w} height={h} rx={5}
      fill={active ? color + "0c" : "#0a0f16"}
      stroke={active ? color : T.border} strokeWidth={active ? 1.5 : 0.75}
      style={active ? { filter: `drop-shadow(0 0 8px ${color}40)` } : {}} />
    <text x={x + w / 2} y={y + h / 2 + 1} textAnchor="middle" dominantBaseline="middle"
      fill={active ? color : T.grayDim} fontSize={w > 60 ? 9 : 10} fontFamily={F} fontWeight={600} letterSpacing={1}>{label}</text>
  </g>;
}

function Dot({ x, y, val, active, label, color = T.green }) {
  const on = active && val;
  return <g>
    <circle cx={x} cy={y} r={8} fill={on ? color + "30" : "#080c14"}
      stroke={active ? (val ? color : T.grayDim) : "#1a2030"} strokeWidth={1}
      style={on ? { filter: `drop-shadow(0 0 5px ${color}50)` } : {}} />
    <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle"
      fill={active ? (val ? color : T.gray) : "#1a2030"} fontSize={9} fontFamily={F} fontWeight={600}>
      {active ? val : "·"}</text>
    {label && <text x={x} y={y - 13} textAnchor="middle" fill={T.gray} fontSize={7} fontFamily={F} opacity={0.5}>{label}</text>}
  </g>;
}

function Wire({ pts, active, color = T.green, progress = 1 }) {
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  return <g>
    <path d={d} fill="none" stroke="#111a28" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    {active && progress > 0 && <path d={d} fill="none" stroke={color} strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" strokeDasharray="800"
      strokeDashoffset={800 * (1 - Math.min(progress, 1))}
      style={{ filter: `drop-shadow(0 0 3px ${color}60)`, transition: "stroke-dashoffset 0.3s ease-out" }} />}
  </g>;
}

function Seg7({ num, size = 1, color = T.red }) {
  const w = 28 * size, h = 44 * size, t = 3 * size, g = 1.5 * size;
  const sw = w * 0.65, sh = h * 0.44, ox = (w - sw) / 2;
  const segs = [[ox+g,g,sw-g*2,t],[ox+sw-t-g,g+t,t,sh-t-g],[ox+sw-t-g,sh+g,t,sh-t-g],
    [ox+g,h-t-g,sw-g*2,t],[ox+g,sh+g,t,sh-t-g],[ox+g,g+t,t,sh-t-g],[ox+g,sh-t/2,sw-g*2,t]];
  const map = {0:[1,1,1,1,1,1,0],1:[0,1,1,0,0,0,0],2:[1,1,0,1,1,0,1],3:[1,1,1,1,0,0,1],
    4:[0,1,1,0,0,1,1],5:[1,0,1,1,0,1,1],6:[1,0,1,1,1,1,1],7:[1,1,1,0,0,0,0],
    8:[1,1,1,1,1,1,1],9:[1,1,1,1,0,1,1]};
  const a = map[num] || [0,0,0,0,0,0,0];
  return <svg width={w} height={h} style={{ display: "block" }}>
    <rect width={w} height={h} rx={3} fill="#0c0404" />
    {segs.map(([sx,sy,sw2,sh2],i) => <rect key={i} x={sx} y={sy} width={sw2} height={sh2} rx={1}
      fill={a[i]?color:"#180808"} opacity={a[i]?1:0.12}
      style={a[i]?{filter:`drop-shadow(0 0 ${3*size}px ${color})`}:{}} />)}
  </svg>;
}

/* ═══ RIPPLE CARRY ADDER CELL ═══ */
function RippleCell({ x, y, bit, a, b, cin, active, step }) {
  const { sum, carry } = fullAdder(a, b, cin);
  const g1x=x+52,g1y=y+2,g2x=x+52,g2y=y+46,g3x=x+124,g3y=y+2,g4x=x+124,g4y=y+46,g5x=x+196,g5y=y+24;
  const s = [false, step>=1, step>=2, step>=3, step>=4];
  return <g>
    <rect x={x-6} y={y-20} width={282} height={96} rx={7} fill={step>0?"#0d131d":"#0a0e16"}
      stroke={step>0?T.border2:T.border} strokeWidth={0.6} />
    <text x={x+264} y={y-9} textAnchor="end" fill={step>0?T.blue:T.grayDim} fontSize={7}
      fontFamily={F} letterSpacing={1.5} fontWeight={600}>BIT {bit}</text>
    <Dot x={x+6} y={y+12} val={a} active={active} label={`A${bit}`} />
    <Dot x={x+6} y={y+48} val={b} active={active} label={`B${bit}`} color={T.orange} />
    <Dot x={x+26} y={y+64} val={cin} active={s[1]} label="Cin" color={T.orange} />
    <Wire pts={[[x+14,y+12],[g1x,y+12],[g1x,g1y+7]]} active={active} progress={s[1]?1:0} />
    <Wire pts={[[x+14,y+48],[x+36,y+48],[x+36,y+28],[g1x+GW,y+28],[g1x+GW,g1y+27]]} active={active} progress={s[1]?1:0} />
    <Gate x={g1x} y={g1y} label="XOR" active={s[1]} />
    <Wire pts={[[x+14,y+12],[x+36,y+12],[x+36,g2y+7],[g2x,g2y+7]]} active={active} progress={s[1]?1:0} />
    <Wire pts={[[x+14,y+48],[x+40,y+48],[x+40,g2y+27],[g2x,g2y+27]]} active={active} progress={s[1]?1:0} />
    <Gate x={g2x} y={g2y} label="AND" active={s[1]} color={T.orange} />
    <Wire pts={[[g1x+GW,g1y+17],[g3x,g3y+7]]} active={s[1]} progress={s[2]?1:0} />
    <Wire pts={[[x+36,y+64],[x+116,y+64],[x+116,g3y+27],[g3x,g3y+27]]} active={s[1]} color={T.orange} progress={s[2]?1:0} />
    <Gate x={g3x} y={g3y} label="XOR" active={s[2]} />
    <Wire pts={[[g1x+GW,g1y+17],[x+116,g1y+17],[x+116,g4y+7],[g4x,g4y+7]]} active={s[2]} progress={s[3]?1:0} />
    <Wire pts={[[x+116,y+64],[x+120,y+64],[x+120,g4y+27],[g4x,g4y+27]]} active={s[2]} color={T.orange} progress={s[3]?1:0} />
    <Gate x={g4x} y={g4y} label="AND" active={s[3]} color={T.orange} />
    <Wire pts={[[g2x+GW,g2y+17],[x+188,g2y+17],[x+188,g5y+27],[g5x,g5y+27]]} active={s[3]} color={T.orange} progress={s[4]?1:0} />
    <Wire pts={[[g4x+GW,g4y+17],[x+192,g4y+17],[x+192,g5y+7],[g5x,g5y+7]]} active={s[3]} color={T.orange} progress={s[4]?1:0} />
    <Gate x={g5x} y={g5y} label="OR" active={s[4]} color={T.orange} />
    <Wire pts={[[g3x+GW,g3y+17],[x+268,g3y+17]]} active={s[2]} progress={s[2]?1:0} />
    <Dot x={x+272} y={g3y+17} val={sum} active={s[2]} label="S" />
    <Wire pts={[[g5x+GW,g5y+17],[x+268,g5y+17]]} active={s[4]} color={T.orange} progress={s[4]?1:0} />
    <Dot x={x+272} y={g5y+17} val={carry} active={s[4]} label="Co" color={T.orange} />
  </g>;
}

/* ═══ RIPPLE CARRY FULL CIRCUIT ═══ */
function RippleCircuit({ bitsA, bitsB, carries, steps, active, resultBits, result, overflow, done }) {
  return <svg width={640} height={430} viewBox="0 0 640 430" style={{ display: "block" }}>
    <defs><pattern id="rdots" width="16" height="16" patternUnits="userSpaceOnUse">
      <circle cx="8" cy="8" r="0.4" fill={T.border} /></pattern></defs>
    <rect width="640" height="430" fill="url(#rdots)" />
    <text x={320} y={18} textAnchor="middle" fill={T.grayDim} fontSize={8} fontFamily={F} letterSpacing={3}>RIPPLE CARRY ADDER</text>
    {[3,2,1,0].map((bitIdx, row) => {
      const cy = 28 + row * 102;
      const cin = bitIdx === 3 ? 0 : carries[bitIdx + 1];
      return <g key={bitIdx}>
        <RippleCell x={30} y={cy} bit={bitIdx} a={bitsA[bitIdx]} b={bitsB[bitIdx]}
          cin={cin} active={active} step={steps[bitIdx]} />
        {bitIdx < 3 && <Wire pts={[[310,cy+44],[340,cy+44],[340,cy+102+64],[56,cy+102+64]]}
          active={steps[bitIdx]>=4} color={T.orange} progress={steps[bitIdx]>=4?1:0} />}
      </g>;
    })}
    {/* Result */}
    <g>
      <rect x={360} y={20} width={260} height={400} rx={8} fill="#080c12" stroke={T.border} strokeWidth={0.6} strokeDasharray="4 3" />
      <text x={490} y={38} textAnchor="middle" fill={T.grayDim} fontSize={8} fontFamily={F} letterSpacing={2}>RESULT</text>
      {[0,1,2,3].map(i => {
        const ry = 56 + i * 88; const act = steps[i]>=2;
        return <g key={i}>
          <rect x={385} y={ry} width={210} height={56} rx={7} fill={act&&resultBits[i]?T.greenGlow:"#0a0e14"}
            stroke={act?(resultBits[i]?T.green+"30":T.border):"#111820"} strokeWidth={0.6} />
          <text x={408} y={ry+20} fill={T.grayDim} fontSize={7} fontFamily={F} letterSpacing={0.5}>S{i}</text>
          <text x={408} y={ry+38} fill={T.grayDim} fontSize={7} fontFamily={F} opacity={0.4}>2^{3-i}</text>
          <text x={490} y={ry+36} textAnchor="middle" fill={act?(resultBits[i]?T.green:T.grayDim):"#111820"}
            fontSize={26} fontWeight={700} fontFamily={F}
            style={act&&resultBits[i]?{filter:`drop-shadow(0 0 8px ${T.green}50)`}:{}}>{act?resultBits[i]:"·"}</text>
          <text x={545} y={ry+34} fill={act&&resultBits[i]?T.green:T.grayDim} fontSize={10} fontFamily={F} opacity={0.5}>
            {act?(resultBits[i]?`+${1<<(3-i)}`:"+0"):""}</text>
        </g>;
      })}
      {done && <g>
        <line x1={390} y1={404} x2={610} y2={404} stroke={T.green+"30"} strokeWidth={0.6} />
        <text x={490} y={420} textAnchor="middle" fill={T.green} fontSize={15} fontWeight={700} fontFamily={F}
          style={{filter:`drop-shadow(0 0 10px ${T.green}60)`}}>= {result}{overflow?` (+${carries[0]*16})`:""}</text>
      </g>}
    </g>
  </svg>;
}

/* ═══ CLA CIRCUIT ═══ */
function CLACircuit({ bitsA, bitsB, claStep, active, result, overflow, done }) {
  const { G, P, C, S } = claCompute(bitsA, bitsB);
  const s1 = claStep >= 1, s2 = claStep >= 2, s3 = claStep >= 3;

  const bitX = (i) => 38 + (3 - i) * 152; // bit 3 on left, bit 0 on right
  const rowY = { input: 50, gp: 110, cla: 220, sum: 320, result: 370 };

  return <svg width={640} height={430} viewBox="0 0 640 430" style={{ display: "block" }}>
    <defs><pattern id="cdots" width="16" height="16" patternUnits="userSpaceOnUse">
      <circle cx="8" cy="8" r="0.4" fill={T.border} /></pattern></defs>
    <rect width="640" height="430" fill="url(#cdots)" />
    <text x={320} y={18} textAnchor="middle" fill={T.grayDim} fontSize={8} fontFamily={F} letterSpacing={3}>CARRY-LOOKAHEAD ADDER</text>
    <text x={320} y={32} textAnchor="middle" fill={T.purple} fontSize={7} fontFamily={F} letterSpacing={1} opacity={0.6}>ALL BITS IN PARALLEL</text>

    {/* Phase labels */}
    <text x={14} y={rowY.input + 4} fill={s1 ? T.blue : T.grayDim} fontSize={7} fontFamily={F} letterSpacing={1}
      style={{ writingMode: "vertical-rl" }} opacity={0.5}>INPUTS</text>
    <text x={14} y={rowY.gp + 10} fill={s1 ? T.cyan : T.grayDim} fontSize={7} fontFamily={F} letterSpacing={1}
      style={{ writingMode: "vertical-rl" }} opacity={0.5}>GEN/PROP</text>
    <text x={14} y={rowY.cla + 10} fill={s2 ? T.purple : T.grayDim} fontSize={7} fontFamily={F} letterSpacing={1}
      style={{ writingMode: "vertical-rl" }} opacity={0.5}>CARRIES</text>
    <text x={14} y={rowY.sum + 4} fill={s3 ? T.green : T.grayDim} fontSize={7} fontFamily={F} letterSpacing={1}
      style={{ writingMode: "vertical-rl" }} opacity={0.5}>SUMS</text>

    {[0,1,2,3].map(i => {
      const bx = bitX(i);
      return <g key={i}>
        {/* Bit column label */}
        <text x={bx + 50} y={42} textAnchor="middle" fill={active ? T.blue : T.grayDim} fontSize={7}
          fontFamily={F} letterSpacing={1.5} fontWeight={600}>BIT {i}</text>

        {/* Input dots */}
        <Dot x={bx + 30} y={rowY.input} val={bitsA[i]} active={active} label={`A${i}`} />
        <Dot x={bx + 70} y={rowY.input} val={bitsB[i]} active={active} label={`B${i}`} color={T.orange} />

        {/* Wires down to G/P gates */}
        <Wire pts={[[bx+30, rowY.input+8],[bx+30, rowY.gp-6],[bx+38, rowY.gp-6],[bx+38, rowY.gp]]}
          active={active} progress={s1?1:0} />
        <Wire pts={[[bx+70, rowY.input+8],[bx+70, rowY.gp-6],[bx+62, rowY.gp-6],[bx+62, rowY.gp]]}
          active={active} color={T.orange} progress={s1?1:0} />

        {/* XOR (Propagate) */}
        <Gate x={bx + 4} y={rowY.gp} label="XOR" active={s1} color={T.cyan} w={46} h={30} />
        {/* AND (Generate) */}
        <Gate x={bx + 54} y={rowY.gp} label="AND" active={s1} color={T.orange} w={46} h={30} />

        {/* P and G labels */}
        {s1 && <>
          <text x={bx+27} y={rowY.gp+44} textAnchor="middle" fill={T.cyan} fontSize={8} fontFamily={F} fontWeight={600}>
            P{i}={P[i]}</text>
          <text x={bx+77} y={rowY.gp+44} textAnchor="middle" fill={T.orange} fontSize={8} fontFamily={F} fontWeight={600}>
            G{i}={G[i]}</text>
        </>}

        {/* Wires from G/P down to CLA box */}
        <Wire pts={[[bx+27, rowY.gp+30],[bx+27, rowY.cla]]} active={s1} color={T.cyan} progress={s2?1:0} />
        <Wire pts={[[bx+77, rowY.gp+30],[bx+77, rowY.cla]]} active={s1} color={T.orange} progress={s2?1:0} />

        {/* Carry out from CLA */}
        <Wire pts={[[bx+50, rowY.cla+48],[bx+50, rowY.sum]]}
          active={s2} color={T.purple} progress={s3?1:0} />

        {/* Carry value */}
        {s2 && <text x={bx+64} y={rowY.cla+60} fill={T.purple} fontSize={8} fontFamily={F} fontWeight={600}>
          C{i}={C[i+1]}</text>}

        {/* Propagate wire to final XOR */}
        <Wire pts={[[bx+27, rowY.gp+30],[bx+27, rowY.gp+52],[bx+10, rowY.gp+52],[bx+10, rowY.sum]]}
          active={s1} color={T.cyan} progress={s3?1:0} />

        {/* Final XOR → Sum */}
        <Gate x={bx+4} y={rowY.sum} label="XOR" active={s3} color={T.green} w={92} h={30} />

        {/* Sum output */}
        <Wire pts={[[bx+50, rowY.sum+30],[bx+50, rowY.result]]} active={s3} progress={s3?1:0} />

        {/* Result box */}
        <rect x={bx + 10} y={rowY.result} width={80} height={42} rx={6}
          fill={s3 && S[i] ? T.greenGlow : "#0a0e14"}
          stroke={s3 ? (S[i] ? T.green+"30" : T.border) : "#111820"} strokeWidth={0.6} />
        <text x={bx+50} y={rowY.result+28} textAnchor="middle"
          fill={s3 ? (S[i] ? T.green : T.grayDim) : "#111820"}
          fontSize={22} fontWeight={700} fontFamily={F}
          style={s3&&S[i]?{filter:`drop-shadow(0 0 8px ${T.green}50)`}:{}}>{s3 ? S[i] : "·"}</text>
      </g>;
    })}

    {/* CLA Magic Box */}
    <rect x={30} y={rowY.cla} width={588} height={48} rx={8}
      fill={s2 ? T.purpleDim : "#0a0e14"}
      stroke={s2 ? T.purple : T.border} strokeWidth={s2 ? 1.5 : 0.6}
      style={s2 ? { filter: `drop-shadow(0 0 12px ${T.purple}30)` } : {}} />
    <text x={320} y={rowY.cla + 20} textAnchor="middle" fill={s2 ? T.purple : T.grayDim}
      fontSize={10} fontFamily={F} fontWeight={700} letterSpacing={2}>CARRY LOOKAHEAD UNIT</text>
    <text x={320} y={rowY.cla + 34} textAnchor="middle" fill={s2 ? T.purple : T.grayDim}
      fontSize={7} fontFamily={F} letterSpacing={1} opacity={0.6}>
      {s2 ? "ALL CARRIES COMPUTED SIMULTANEOUSLY" : "WAITING FOR G AND P VALUES"}</text>

    {/* Overflow carry */}
    {s2 && C[0] === 1 && <g>
      <text x={622} y={rowY.cla+28} fill={T.orange} fontSize={8} fontFamily={F} fontWeight={600}>C out=1</text>
    </g>}

    {/* Final result */}
    {done && <text x={320} y={424} textAnchor="middle" fill={T.green} fontSize={14} fontWeight={700} fontFamily={F}
      style={{filter:`drop-shadow(0 0 10px ${T.green}60)`}}>
      = {result}{overflow?" (overflow)":""}</text>}
  </svg>;
}

/* ═══ UI COMPONENTS ═══ */

function Pill({ children, color }) {
  return <span style={{ display:"inline-block",padding:"2px 8px",borderRadius:99,fontSize:10,fontFamily:F,
    fontWeight:600,letterSpacing:0.5,background:color+"18",color,border:`1px solid ${color}40` }}>{children}</span>;
}

function Accordion({ title, badge, children, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen || false);
  return <div style={{ background:T.surface,border:`1px solid ${open?T.border2:T.border}`,borderRadius:12,overflow:"hidden" }}>
    <button onClick={()=>setOpen(!open)} style={{
      width:"100%",padding:"13px 14px",background:"none",border:"none",cursor:"pointer",
      display:"flex",alignItems:"center",gap:10 }}>
      {badge && <span style={{ fontSize:14 }}>{badge}</span>}
      <span style={{ flex:1,textAlign:"left",fontSize:13,fontWeight:600,color:T.white,fontFamily:FS }}>{title}</span>
      <span style={{ fontSize:10,color:T.grayDim,transition:"transform 0.2s",transform:open?"rotate(90deg)":"none" }}>▶</span>
    </button>
    {open && <div style={{ padding:"0 14px 14px",fontSize:13,color:T.gray,lineHeight:1.8,fontFamily:FS }}>{children}</div>}
  </div>;
}

/* ═══ NARRATION ═══ */

function RippleNarration({ numA, numB, steps, done }) {
  const bitsA = toBin(numA), bitsB = toBin(numB);
  const getActive = () => { for (let i=3;i>=0;i--) if(steps[i]>0&&steps[i]<=4) return i; return done?-1:null; };
  const activeBit = getActive();
  const hi = (ch, col=T.green) => <span style={{ color:col,fontWeight:600,fontFamily:F }}>{ch}</span>;
  const dim = (ch) => <span style={{ opacity:0.5 }}>{ch}</span>;
  const box = { margin:"8px 0 0",padding:"10px 12px",background:T.bg,borderRadius:8,fontSize:12,fontFamily:F,lineHeight:2,border:`1px solid ${T.border}` };

  if (activeBit===null && !done) return <div>
    <p style={{ fontSize:14,color:T.blue,margin:0,fontWeight:600,fontFamily:FS }}>Ready</p>
    <p style={{ fontSize:13,color:T.gray,margin:"8px 0 0",lineHeight:1.8,fontFamily:FS }}>
      Tap {hi("▶ PLAY")} or {hi("STEP ▸",T.blue)} to watch the ripple carry adder process one bit at a time —
      each bit waits for the previous carry. 16 steps total.
    </p>
  </div>;

  if (done) {
    const r=(numA+numB)&0xf, ov=numA+numB>15;
    return <div>
      <p style={{ fontSize:14,color:T.green,margin:0,fontWeight:600,fontFamily:FS }}>Complete — 16 steps</p>
      <div style={box}>
        {"  "}{hi(toBin(numA).join(""))}{dim(` (${numA})`)}<br/>
        {"+ "}{hi(toBin(numB).join(""),T.orange)}{dim(` (${numB})`)}<br/>
        {dim("──────")}<br/>
        {ov&&hi("1",T.orange)}{hi(toBin(r).join(""),T.white)}{dim(` (${numA+numB})`)}
        {ov&&<><br/><span style={{color:T.orange,fontSize:10}}>↑ overflow</span></>}
      </div>
    </div>;
  }

  const bit=activeBit, a=bitsA[bit], b=bitsB[bit];
  let cin=0; if(bit<3){let c=0;for(let i=3;i>bit;i--)c=fullAdder(bitsA[i],bitsB[i],c).carry;cin=c;}
  const {xor1,sum,and1,and2,carry}=fullAdder(a,b,cin);
  const step=steps[bit];

  const titles=[null,"Initial gates fire","Carry-in → SUM","Carry detection pt.2","OR → Carry-out"];
  const pCol=[null,T.green,T.green,T.orange,T.orange];
  const bodies=[null,
    <><p style={{fontSize:13,color:T.gray,margin:"6px 0 0",lineHeight:1.8,fontFamily:FS}}>
      {hi(`A${bit}=${a}`)} and {hi(`B${bit}=${b}`,T.orange)} enter XOR and AND simultaneously:
    </p><div style={box}>{hi("XOR")}{hi(`(${a},${b})`,T.gray)}→{hi(xor1)} {dim(a!==b?"different":"same")}<br/>
      {hi("AND",T.orange)}{hi(`(${a},${b})`,T.gray)}→{hi(and1,T.orange)} {dim(a&&b?"both 1":"no")}</div></>,
    <><p style={{fontSize:13,color:T.gray,margin:"6px 0 0",lineHeight:1.8,fontFamily:FS}}>
      Partial sum ({hi(xor1)}) XORs with carry-in ({hi(`${cin}`,T.orange)}):
    </p><div style={box}>{hi("XOR")}{hi(`(${xor1},${cin})`,T.gray)}→{hi(sum,T.white)}{" "}<span style={{color:T.green,fontWeight:700,fontSize:11}}>◀ SUM</span></div></>,
    <><p style={{fontSize:13,color:T.gray,margin:"6px 0 0",lineHeight:1.8,fontFamily:FS}}>
      Did carry-in propagate?
    </p><div style={box}>{hi("AND",T.orange)}{hi(`(${xor1},${cin})`,T.gray)}→{hi(and2,T.orange)}</div></>,
    <><p style={{fontSize:13,color:T.gray,margin:"6px 0 0",lineHeight:1.8,fontFamily:FS}}>
      OR merges both carry sources:
    </p><div style={box}>{hi("OR",T.orange)}{hi(`(${and1},${and2})`,T.gray)}→{hi(carry,T.orange)}{" "}<span style={{color:T.orange,fontWeight:700,fontSize:11}}>◀ CARRY</span></div>
      <p style={{fontSize:12,color:T.grayDim,margin:"6px 0 0",lineHeight:1.6,fontFamily:FS}}>
        {carry?`Carry=1! (${a}+${b}+${cin}=${a+b+cin}≥2)`:`Carry=0 (${a}+${b}+${cin}=${a+b+cin}<2)`}
        {bit>0?` → feeds Bit ${bit-1}.`:` → overflow flag.`}
      </p></>,
  ];

  return <div>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
      <Pill color={T.blue}>BIT {bit}</Pill><Pill color={pCol[step]}>STEP {step}/4</Pill>
    </div>
    <p style={{fontSize:14,color:T.white,margin:0,fontWeight:600,fontFamily:FS}}>{titles[step]}</p>
    {bodies[step]}
  </div>;
}

function CLANarration({ numA, numB, claStep, done }) {
  const bitsA=toBin(numA), bitsB=toBin(numB);
  const {G,P,C,S}=claCompute(bitsA,bitsB);
  const hi=(ch,col=T.green)=><span style={{color:col,fontWeight:600,fontFamily:F}}>{ch}</span>;
  const dim=(ch)=><span style={{opacity:0.5}}>{ch}</span>;
  const box={margin:"8px 0 0",padding:"10px 12px",background:T.bg,borderRadius:8,fontSize:12,fontFamily:F,lineHeight:2,border:`1px solid ${T.border}`};

  if(claStep===0&&!done) return <div>
    <p style={{fontSize:14,color:T.purple,margin:0,fontWeight:600,fontFamily:FS}}>Ready</p>
    <p style={{fontSize:13,color:T.gray,margin:"8px 0 0",lineHeight:1.8,fontFamily:FS}}>
      The carry-lookahead adder processes all 4 bits {hi("simultaneously",T.purple)} using extra logic
      to predict carries. Only {hi("3 steps",T.purple)} vs 16 for ripple carry.
    </p>
  </div>;

  if(done) {
    const r=(numA+numB)&0xf, ov=numA+numB>15;
    return <div>
      <p style={{fontSize:14,color:T.green,margin:0,fontWeight:600,fontFamily:FS}}>Complete — just 3 steps!</p>
      <div style={box}>
        {"  "}{hi(toBin(numA).join(""))}{dim(` (${numA})`)}<br/>
        {"+ "}{hi(toBin(numB).join(""),T.orange)}{dim(` (${numB})`)}<br/>
        {dim("──────")}<br/>
        {ov&&hi("1",T.orange)}{hi(toBin(r).join(""),T.white)}{dim(` (${numA+numB})`)}
      </div>
      <p style={{fontSize:12,color:T.purple,margin:"8px 0 0",lineHeight:1.7,fontFamily:FS,fontWeight:500}}>
        5.3× fewer steps than ripple carry — and this advantage grows with wider numbers. A 64-bit CLA still takes ~3 gate delays.
      </p>
    </div>;
  }

  const narrs=[null,
    <div key={1}>
      <div style={{display:"flex",gap:8,marginBottom:6}}><Pill color={T.cyan}>PHASE 1</Pill><Pill color={T.blue}>ALL 4 BITS</Pill></div>
      <p style={{fontSize:14,color:T.white,margin:0,fontWeight:600,fontFamily:FS}}>Generate & Propagate (parallel)</p>
      <p style={{fontSize:13,color:T.gray,margin:"6px 0 0",lineHeight:1.8,fontFamily:FS}}>
        All 4 bit positions compute two signals at once:
      </p>
      <div style={box}>
        {[3,2,1,0].map(i=><span key={i}>
          {hi(`P${i}`,T.cyan)}={hi(`${bitsA[i]}⊕${bitsB[i]}`,T.gray)}={hi(P[i],T.cyan)}{" "}
          {hi(`G${i}`,T.orange)}={hi(`${bitsA[i]}·${bitsB[i]}`,T.gray)}={hi(G[i],T.orange)}<br/>
        </span>)}
      </div>
      <p style={{fontSize:12,color:T.grayDim,margin:"6px 0 0",lineHeight:1.65,fontFamily:FS}}>
        {hi("P",T.cyan)} (Propagate) = "will a carry pass through?" via XOR.{" "}
        {hi("G",T.orange)} (Generate) = "does this bit create a carry?" via AND.
        All 4 computed {hi("simultaneously",T.purple)} — no waiting.
      </p>
    </div>,
    <div key={2}>
      <div style={{display:"flex",gap:8,marginBottom:6}}><Pill color={T.purple}>PHASE 2</Pill><Pill color={T.purple}>THE KEY TRICK</Pill></div>
      <p style={{fontSize:14,color:T.white,margin:0,fontWeight:600,fontFamily:FS}}>Carry Lookahead (all at once!)</p>
      <p style={{fontSize:13,color:T.gray,margin:"6px 0 0",lineHeight:1.8,fontFamily:FS}}>
        Instead of waiting for carries to ripple, the CLA unit uses G and P to compute {hi("every carry simultaneously",T.purple)}:
      </p>
      <div style={box}>
        {[3,2,1,0].map(i=><span key={i}>
          {hi(`C${i}`,T.purple)}={hi(C[i+1],T.purple)}{" "}{dim(C[i+1]?`← bit ${i} gets a carry-in`:`← no carry into bit ${i}`)}<br/>
        </span>)}
        {hi(`C_out`,T.orange)}={hi(C[0],T.orange)}{" "}{dim(C[0]?"← overflow!":"← no overflow")}
      </div>
      <p style={{fontSize:12,color:T.grayDim,margin:"6px 0 0",lineHeight:1.65,fontFamily:FS}}>
        The formula uses chained OR/AND logic: C₁ = G₀ + P₀·C₀, etc. The key insight: since all G and P are already known,
        all carries resolve in {hi("one gate delay",T.purple)} — no rippling!
      </p>
    </div>,
    <div key={3}>
      <div style={{display:"flex",gap:8,marginBottom:6}}><Pill color={T.green}>PHASE 3</Pill><Pill color={T.blue}>ALL 4 BITS</Pill></div>
      <p style={{fontSize:14,color:T.white,margin:0,fontWeight:600,fontFamily:FS}}>Final Sums (parallel)</p>
      <p style={{fontSize:13,color:T.gray,margin:"6px 0 0",lineHeight:1.8,fontFamily:FS}}>
        Each bit XORs its Propagate with its carry-in to get the final sum:
      </p>
      <div style={box}>
        {[0,1,2,3].map(i=><span key={i}>
          {hi(`S${i}`,T.green)}={hi(`P${i}`,T.cyan)}⊕{hi(`C${i}`,T.purple)}={hi(`${P[i]}⊕${C[i+1]}`,T.gray)}={hi(S[i],T.green)}<br/>
        </span>)}
      </div>
      <p style={{fontSize:12,color:T.grayDim,margin:"6px 0 0",lineHeight:1.65,fontFamily:FS}}>
        All 4 sums computed simultaneously. Done in 3 total steps!
      </p>
    </div>,
  ];
  return <div>{narrs[claStep]}</div>;
}

/* ═══ MAIN ═══ */
export default function ALUSimulator() {
  const [numA, setNumA] = useState(5);
  const [numB, setNumB] = useState(3);
  const [mode, setMode] = useState("ripple"); // "ripple" | "cla"
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [steps, setSteps] = useState([0,0,0,0]); // ripple
  const [claStep, setClaStep] = useState(0); // cla: 0-3
  const [done, setDone] = useState(false);
  const [tab, setTab] = useState("circuit");
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef(null);
  const stateRef = useRef({ bit: 3, s: 0 });

  const bitsA=toBin(numA), bitsB=toBin(numB);
  const carries=[0]; for(let i=3;i>=0;i--)carries.unshift(fullAdder(bitsA[i],bitsB[i],carries[0]).carry);
  const result=(numA+numB)&0xf, overflow=numA+numB>15, resultBits=toBin(result);

  const totalSteps = mode==="ripple" ? 16 : 3;
  const currentStep = mode==="ripple" ? steps.reduce((a,s)=>a+Math.min(s,4),0) : claStep;
  const started = running||done||paused;

  const getDelay = () => [1600, 900, 450][speed] || 900;

  const advanceRipple = useCallback(() => {
    const st=stateRef.current; if(st.bit<0) return false;
    st.s++;
    setSteps(p=>{const n=[...p];n[st.bit]=st.s;return n;});
    if(st.s>=4){st.bit--;st.s=0;if(st.bit<0){setDone(true);setRunning(false);setPaused(false);return false;}}
    return true;
  },[]);

  const advanceCLA = useCallback(() => {
    const st = stateRef.current;
    if (st.s >= 3) return false;
    st.s++;
    setClaStep(st.s);
    if (st.s >= 3) { setDone(true); setRunning(false); setPaused(false); return false; }
    return true;
  },[]);

  const advance = mode==="ripple" ? advanceRipple : advanceCLA;

  const startTimer = useCallback(() => {
    if(timerRef.current)clearInterval(timerRef.current);
    timerRef.current=setInterval(()=>{if(!advance())clearInterval(timerRef.current);},getDelay());
  },[advance,speed]);

  const play = useCallback(() => {
    if(done)return;
    if(!running&&!paused){
      stateRef.current={bit:3,s:0};
      setSteps([0,0,0,0]);setClaStep(0);setDone(false);
    }
    setRunning(true);setPaused(false);startTimer();
  },[done,running,paused,startTimer]);

  const pause = useCallback(() => {
    if(timerRef.current)clearInterval(timerRef.current);
    setPaused(true);setRunning(false);
  },[]);

  const stepFwd = useCallback(() => {
    if(done)return;
    if(!running&&!paused){
      stateRef.current={bit:3,s:0};
      setSteps([0,0,0,0]);setClaStep(0);setDone(false);setPaused(true);
    }
    if(timerRef.current)clearInterval(timerRef.current);
    setRunning(false);setPaused(true);
    advance();
  },[done,running,paused,advance]);

  const reset = useCallback(() => {
    if(timerRef.current)clearInterval(timerRef.current);
    stateRef.current={bit:3,s:0};
    setRunning(false);setPaused(false);setSteps([0,0,0,0]);setClaStep(0);setDone(false);
  },[]);

  useEffect(()=>{if(running&&!paused)startTimer();},[speed]);
  useEffect(()=>()=>{if(timerRef.current)clearInterval(timerRef.current);},[]);

  // Reset when switching modes
  const switchMode = (m) => { reset(); setMode(m); };

  const [gateTab,setGateTab]=useState("XOR");
  const gateDescs={
    XOR:"Outputs 1 when inputs differ. It's addition mod 2 — the core of binary math. Two XOR gates chained compute A⊕B⊕Cin = Sum.",
    AND:"Outputs 1 only when both inputs are 1. Detects carries — when both bits overflow, like 1+1=10 in binary.",
    OR:"Outputs 1 when any input is 1. Merges two carry sources (generate + propagate) into a single carry-out.",
  };
  const ttData={XOR:{out:[0,1,1,0],c:T.green},AND:{out:[0,0,0,1],c:T.orange},OR:{out:[0,1,1,1],c:T.orange}};
  const cell={padding:"5px 0",fontSize:12,fontFamily:F,textAlign:"center"};

  return (
    <div style={{ background:T.bg,minHeight:"100vh",fontFamily:FS,color:T.white }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{ padding:"18px 16px 0",textAlign:"center" }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
          <div style={{width:7,height:7,borderRadius:99,background:T.green,boxShadow:`0 0 12px ${T.green}80`}} />
          <h1 style={{fontSize:14,fontWeight:700,fontFamily:F,letterSpacing:4,margin:0}}>4-BIT BINARY ADDER</h1>
          <div style={{width:7,height:7,borderRadius:99,background:T.green,boxShadow:`0 0 12px ${T.green}80`}} />
        </div>
        <p style={{fontSize:9,color:T.grayDim,marginTop:4,letterSpacing:2,fontFamily:F}}>VISUAL ALU SIMULATOR</p>
      </div>

      {/* ARCHITECTURE TOGGLE */}
      <div style={{ padding:"12px 12px 0" }}>
        <div style={{ display:"flex",background:T.surface,borderRadius:10,padding:3,border:`1px solid ${T.border}` }}>
          {[["ripple","Ripple Carry",T.green,"16 steps"],["cla","Carry Lookahead",T.purple,"3 steps"]].map(([key,label,col,sub])=>(
            <button key={key} onClick={()=>switchMode(key)} style={{
              flex:1,padding:"10px 4px 6px",borderRadius:8,border:"none",cursor:"pointer",
              background:mode===key?T.surface2:"transparent",transition:"all 0.15s",
              display:"flex",flexDirection:"column",alignItems:"center",gap:2,
            }}>
              <span style={{fontSize:11,fontWeight:700,fontFamily:F,letterSpacing:1,
                color:mode===key?col:T.grayDim}}>{label}</span>
              <span style={{fontSize:9,fontFamily:F,color:mode===key?col:T.grayDim,opacity:0.5}}>{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* INPUTS + DISPLAY */}
      <div style={{ padding:"10px 12px 0" }}>
        <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:14 }}>
          <div style={{ display:"flex",gap:14,marginBottom:12 }}>
            {[["A",numA,setNumA,T.green],["B",numB,setNumB,T.orange]].map(([label,val,set,col])=>(
              <div key={label} style={{flex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}}>
                  <span style={{fontSize:10,fontFamily:F,color:T.gray,letterSpacing:1}}>{label}</span>
                  <div style={{display:"flex",alignItems:"baseline",gap:5}}>
                    <span style={{fontSize:20,fontWeight:700,color:col,fontFamily:F}}>{val}</span>
                    <span style={{fontSize:9,color:T.grayDim,fontFamily:F}}>{toBin(val).join("")}</span>
                  </div>
                </div>
                <input type="range" min={0} max={15} value={val}
                  onChange={e=>{set(+e.target.value);reset();}} style={{width:"100%",accentColor:col,height:4}} />
              </div>
            ))}
          </div>

          {/* 7-seg display */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"10px 0",
            borderTop:`1px solid ${T.border}`,borderBottom:`1px solid ${T.border}`,marginBottom:12}}>
            <Seg7 num={numA} color={T.green} size={1} />
            <span style={{fontSize:18,color:T.grayDim,fontWeight:300}}>+</span>
            <Seg7 num={numB} color={T.orange} size={1} />
            <span style={{fontSize:18,color:T.grayDim,fontWeight:300}}>=</span>
            <Seg7 num={done?Math.floor((numA+numB)/10):null} size={1} />
            <Seg7 num={done?(numA+numB)%10:null} size={1} />
            {done&&overflow&&<div style={{padding:"2px 7px",borderRadius:5,fontSize:8,fontFamily:F,
              fontWeight:600,color:T.orange,background:T.orangeDim,border:`1px solid ${T.orange}30`,letterSpacing:1}}>OVF</div>}
          </div>

          {/* Transport */}
          <div style={{display:"flex",gap:5,marginBottom:8}}>
            <button onClick={running?pause:play} disabled={done} style={{
              flex:1,padding:"11px 0",borderRadius:9,cursor:done?"default":"pointer",
              fontFamily:F,fontSize:12,fontWeight:700,letterSpacing:2,
              background:done?T.surface2:running?`linear-gradient(135deg,${T.orange}20,${T.orange}08)`
                :`linear-gradient(135deg,${T.green}20,${T.green}08)`,
              color:done?T.grayDim:running?T.orange:T.green,
              border:`1px solid ${done?T.border:running?T.orange:T.green}40`,
              opacity:done?0.5:1,transition:"all 0.2s",
            }}>{done?"✓ DONE":running?"❚❚ PAUSE":(paused?"▶ RESUME":"▶ PLAY")}</button>
            <button onClick={stepFwd} disabled={done} style={{
              padding:"11px 14px",borderRadius:9,cursor:done?"default":"pointer",
              fontFamily:F,fontSize:11,fontWeight:600,letterSpacing:1,
              background:T.surface2,color:done?T.grayDim:T.blue,
              border:`1px solid ${done?T.border:T.blue}40`,opacity:done?0.5:1,
            }}>STEP▸</button>
            <button onClick={reset} style={{
              padding:"11px 14px",borderRadius:9,cursor:"pointer",fontFamily:F,fontSize:12,fontWeight:600,
              background:T.surface2,color:started?T.white:T.grayDim,border:`1px solid ${T.border}`,
            }}>↺</button>
          </div>

          {/* Speed + Progress */}
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{display:"flex",gap:3}}>
              {[["0.5×",0],["1×",1],["2×",2]].map(([label,val])=>(
                <button key={val} onClick={()=>setSpeed(val)} style={{
                  padding:"4px 8px",borderRadius:5,cursor:"pointer",fontFamily:F,fontSize:9,fontWeight:600,
                  background:speed===val?T.blueDim:"transparent",color:speed===val?T.blue:T.grayDim,
                  border:`1px solid ${speed===val?T.blue+"40":T.border}`,transition:"all 0.15s",
                }}>{label}</button>
              ))}
            </div>
            <div style={{flex:1,height:3,background:T.border,borderRadius:99,overflow:"hidden"}}>
              <div style={{width:`${Math.round((currentStep/totalSteps)*100)}%`,height:"100%",
                background:done?T.green:mode==="cla"?`linear-gradient(90deg,${T.purple},${T.green})`
                  :`linear-gradient(90deg,${T.green},${T.blue})`,
                borderRadius:99,transition:"width 0.35s ease"}} />
            </div>
            <span style={{fontSize:9,fontFamily:F,color:T.grayDim,minWidth:30,textAlign:"right"}}>
              {currentStep}/{totalSteps}
            </span>
          </div>
        </div>
      </div>

      {/* VIEW TABS */}
      <div style={{ padding:"10px 12px 0" }}>
        <div style={{display:"flex",background:T.surface,borderRadius:10,padding:3,border:`1px solid ${T.border}`}}>
          {[["circuit","⚡ Circuit"],["learn","📖 Learn"]].map(([key,label])=>(
            <button key={key} onClick={()=>setTab(key)} style={{
              flex:1,padding:"9px 0",borderRadius:8,border:"none",cursor:"pointer",
              fontFamily:F,fontSize:10,fontWeight:600,letterSpacing:1,
              background:tab===key?T.surface2:"transparent",
              color:tab===key?T.white:T.grayDim,transition:"all 0.15s",
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* CIRCUIT TAB */}
      {tab==="circuit" && (
        <div style={{padding:10}}>
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden"}}>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",padding:6}}>
              {mode==="ripple"
                ? <RippleCircuit bitsA={bitsA} bitsB={bitsB} carries={carries} steps={steps}
                    active={started} resultBits={resultBits} result={result} overflow={overflow} done={done} />
                : <CLACircuit bitsA={bitsA} bitsB={bitsB} claStep={claStep}
                    active={started} result={result} overflow={overflow} done={done} />}
            </div>
            <div style={{display:"flex",gap:14,padding:"8px 12px",borderTop:`1px solid ${T.border}`,
              fontSize:9,color:T.grayDim,fontFamily:F,flexWrap:"wrap"}}>
              <span><span style={{color:T.green}}>●</span> Sum</span>
              <span><span style={{color:T.orange}}>●</span> Carry</span>
              {mode==="cla"&&<><span><span style={{color:T.cyan}}>●</span> Propagate</span>
                <span><span style={{color:T.purple}}>●</span> Lookahead</span></>}
            </div>
          </div>
        </div>
      )}

      {/* LEARN TAB */}
      {tab==="learn" && (
        <div style={{padding:10,display:"flex",flexDirection:"column",gap:8}}>
          {/* Live narration */}
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{width:3,height:13,borderRadius:2,background:mode==="cla"?T.purple:T.blue}} />
              <span style={{fontSize:10,fontWeight:700,fontFamily:F,color:mode==="cla"?T.purple:T.blue,letterSpacing:2}}>
                LIVE TRACE — {mode==="ripple"?"RIPPLE CARRY":"CARRY LOOKAHEAD"}
              </span>
            </div>
            {mode==="ripple"
              ? <RippleNarration numA={numA} numB={numB} steps={steps} done={done} />
              : <CLANarration numA={numA} numB={numB} claStep={claStep} done={done} />}
          </div>

          {/* Comparison card - always visible */}
          <div style={{background:mode==="cla"?T.purpleDim:T.surface,border:`1px solid ${mode==="cla"?T.purple+"30":T.border}`,
            borderRadius:12,padding:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <span style={{fontSize:14}}>⚔️</span>
              <span style={{fontSize:13,fontWeight:600,color:T.white,fontFamily:FS}}>Ripple vs Lookahead</span>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1,background:T.bg,borderRadius:8,padding:"10px 12px",border:`1px solid ${T.border}`}}>
                <span style={{fontSize:10,fontFamily:F,color:T.green,fontWeight:600,letterSpacing:1}}>RIPPLE</span>
                <div style={{fontSize:22,fontWeight:700,fontFamily:F,color:T.white,margin:"4px 0"}}>16</div>
                <span style={{fontSize:10,fontFamily:F,color:T.grayDim}}>steps (4 bits)</span><br/>
                <span style={{fontSize:9,fontFamily:F,color:T.grayDim,opacity:0.6}}>~256 for 64-bit</span>
              </div>
              <div style={{flex:1,background:T.bg,borderRadius:8,padding:"10px 12px",border:`1px solid ${T.purple}30`}}>
                <span style={{fontSize:10,fontFamily:F,color:T.purple,fontWeight:600,letterSpacing:1}}>LOOKAHEAD</span>
                <div style={{fontSize:22,fontWeight:700,fontFamily:F,color:T.white,margin:"4px 0"}}>3</div>
                <span style={{fontSize:10,fontFamily:F,color:T.grayDim}}>steps (4 bits)</span><br/>
                <span style={{fontSize:9,fontFamily:F,color:T.purple,opacity:0.8}}>~3 for 64-bit too!</span>
              </div>
            </div>
            <p style={{fontSize:12,color:T.gray,margin:"10px 0 0",lineHeight:1.7,fontFamily:FS}}>
              Ripple carry scales linearly — double the bits, double the delay. Carry-lookahead stays nearly constant
              because all carries are computed in parallel. That's why every modern CPU uses lookahead (or similar).
            </p>
          </div>

          {/* Gate reference */}
          <Accordion title="Logic Gate Reference" badge="⚡" defaultOpen>
            <div style={{display:"flex",gap:4,marginBottom:10}}>
              {["XOR","AND","OR"].map(g=>(
                <button key={g} onClick={()=>setGateTab(g)} style={{
                  flex:1,padding:"7px 0",borderRadius:7,
                  border:`1px solid ${gateTab===g?(g==="XOR"?T.green:T.orange)+"40":T.border}`,
                  background:gateTab===g?(g==="XOR"?T.greenDim:T.orangeDim):"transparent",
                  color:gateTab===g?(g==="XOR"?T.green:T.orange):T.grayDim,
                  fontFamily:F,fontSize:11,fontWeight:600,cursor:"pointer",
                }}>{g}</button>
              ))}
            </div>
            <p style={{margin:"0 0 4px"}}>{gateDescs[gateTab]}</p>
            <table style={{borderCollapse:"collapse",width:"100%",marginTop:8}}>
              <thead><tr style={{borderBottom:`1px solid ${T.border}`}}>
                {["A","B","Out"].map(h=><td key={h} style={{...cell,fontSize:9,color:T.gray,letterSpacing:1,paddingBottom:6}}>{h}</td>)}
              </tr></thead>
              <tbody>{[[0,0],[0,1],[1,0],[1,1]].map((inp,i)=><tr key={i}>
                <td style={{...cell,color:inp[0]?T.green:T.grayDim}}>{inp[0]}</td>
                <td style={{...cell,color:inp[1]?T.green:T.grayDim}}>{inp[1]}</td>
                <td style={{...cell,color:ttData[gateTab].out[i]?ttData[gateTab].c:T.grayDim,
                  fontWeight:ttData[gateTab].out[i]?700:400}}>{ttData[gateTab].out[i]}</td>
              </tr>)}</tbody>
            </table>
          </Accordion>

          <Accordion title="Why Binary Addition Works" badge="🔢">
            <div style={{fontFamily:F,fontSize:12,margin:"6px 0",padding:"10px 12px",
              background:T.bg,borderRadius:8,lineHeight:2.2,border:`1px solid ${T.border}`}}>
              0 + 0 = <span style={{color:T.green}}>0</span><br/>
              0 + 1 = <span style={{color:T.green}}>1</span><br/>
              1 + 1 = <span style={{color:T.orange}}>10</span> <span style={{color:T.grayDim}}>(write 0, carry 1)</span>
            </div>
            <p>Same as decimal — column by column. XOR computes the digit, AND+OR compute the carry.</p>
          </Accordion>

          <Accordion title="How Real CPUs Do It" badge="🖥️">
            <p>Modern 64-bit CPUs use hierarchical carry-lookahead — groups of 4 bits each use CLA, then a second level of
            lookahead across groups. The result: 64-bit addition in just a few nanoseconds.</p>
            <p>What takes ~16 seconds at 0.5× speed here happens in under <strong style={{color:T.purple}}>1 nanosecond</strong> on
            your phone — billions of times per second.</p>
          </Accordion>
        </div>
      )}
    </div>
  );
}

