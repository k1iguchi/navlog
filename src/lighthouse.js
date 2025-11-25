// Shared Logic for Lighthouse Simulation
window.LighthouseSim = window.LighthouseSim || {};

(function(exports) {
  const colorMap = {
    W: "white",
    R: "red",
    G: "green",
    Y: "yellow",
    Am: "#FFBF00", // Amber
    "W/R": "orange",
    "W/G": "#88ffcc",
    "R/G": "#ffaa44",
    "W/R/G": "yellow"
  };

  function parseLightCode(code) {
    // Normalize code
    code = code.trim().replace(/\s+/g, " ");
    
    // Regex to capture Type, Param, Colors, Period
    // Types: Gp Fl, Gp Oc, Al Fl, Al Oc, Al Iso, Fl F, FFl, LFl, Iso, Oc, Fl, Mo, Q, VQ, UQ, IQ, Dir F, Dir, F
    const regex = /^(?<type>Gp\s*Fl|Gp\s*Oc|Al\s*Fl|Al\s*Oc|Al\s*Iso|Fl\s*F|FFl|LFl|Iso|Oc|Fl|Mo|Q|VQ|UQ|IQ|Dir\s*F|Dir|F)(?:\((?<param>[^)]+)\))?\s+(?<colors>(?:[WRGY]|Am)+(?:\s+(?:[WRGY]|Am)+)*)(?:\s+(?<period>[\d.]+)s?)?$/i;
    
    const match = code.match(regex);
    if (!match) return null;

    const groups = match.groups;
    const type = groups.type.replace(/\s+/g, " ").toUpperCase(); // Normalize type (e.g. "Gp Fl")
    const param = groups.param || null;
    const colors = groups.colors.split(/\s+/).map(c => {
      const upper = c.toUpperCase();
      return upper === "AM" ? "Am" : upper; // Preserve Am case if needed, but map keys are mostly upper
    });
    const period = groups.period ? parseFloat(groups.period) : null;

    return { type, param, colors, period };
  }

  function generateSequence(parsed) {
    if (!parsed) return [];
    const { type, param, colors, period } = parsed;
    const sequence = [];

    // Helper to parse count from param (e.g. "3", "2+1")
    const parseCount = (p) => {
      if (!p) return [1];
      if (p.includes("+")) return p.split("+").map(Number);
      return [parseInt(p, 10)];
    };

    // Helper to get total count
    const getTotalCount = (counts) => counts.reduce((a, b) => a + b, 0);

    // Default period handling
    // Dir and F can have no period (infinite). Others must have period.
    // If period is missing for others, we can't simulate properly, but we'll default to something safe or return empty.
    // Spec says: "Dir と単独の F は周期を省略可... 省略時は「常時点灯＝周期無し」"
    const isContinuous = (type === "DIR" || type === "DIR F" || type === "F") && !period;
    const safePeriod = period || 10; // Fallback for calculation if needed

    // Color cycling logic
    // For Al, Fl(n), etc., colors cycle.
    // For Dir, we just use the first color or cycle for demo?
    // Spec: "Dir ... 周期や順番の概念はなく... 指定した色をそのまま可視化"
    // We'll cycle colors for Dir in simulator to show available sectors.
    
    let colorIndex = 0;
    const getNextColor = () => colors[colorIndex++ % colors.length];

    // Intensity: 1 (Flash/On), 0 (Off), 0.5 (Fixed background)
    
    switch (type) {
      case "F":
      case "DIR":
      case "DIR F":
        if (isContinuous) {
          // Always on
          // If multiple colors, maybe cycle slowly? Or just show first.
          // Let's cycle slowly (e.g. 3s) to show all sector colors.
          const duration = 3.0;
          for (let i = 0; i < colors.length; i++) {
            sequence.push({ on: true, duration: duration, color: colors[i], intensity: 1 });
          }
        } else {
          // Period specified? Treat as continuous but maybe cycle within period?
          // Spec says "Dir F ... 周期を省略可". If present, maybe it behaves like Al?
          // But usually Dir F is fixed. We'll ignore period for F/Dir unless it implies something else.
          // Actually, let's just do the same slow cycle.
           const duration = period ? period / colors.length : 3.0;
           for (let i = 0; i < colors.length; i++) {
            sequence.push({ on: true, duration: duration, color: colors[i], intensity: 1 });
          }
        }
        break;

      case "FL":
      case "GP FL":
        {
          const counts = parseCount(param);
          const totalFlashes = getTotalCount(counts);
          // If multiple colors and totalFlashes == 1 (Single Fl), it might be mixed color "Fl W R" -> "W/R"
          // But spec says: "単発の Fl ... で複数色が並ぶと ... 1 トークンとして扱います"
          // Wait, if param is null, counts is [1].
          // If colors > 1 and counts=[1], treat as mixed color?
          // Spec: "Fl W R 5s ... 白と赤を同時に発光"
          // But if arcs exist, it's sector.
          // Simulator doesn't know about arcs here (unless passed).
          // We'll assume mixed if no arcs context, OR cycle if it's Al?
          // Wait, "Fl W R" is simultaneous. "Al Fl W R" is alternating.
          // If type is just "Fl", and colors=["W", "R"], it's simultaneous.
          
          let effectiveColors = [...colors];
          if (type === "FL" && totalFlashes === 1 && colors.length > 1) {
             // Simultaneous
             effectiveColors = [colors.join("/")];
          }

          // If we have multiple colors now (e.g. Al Fl logic is handled by AL FL type?),
          // Standard Fl with multiple colors usually implies alternating if not simultaneous?
          // Actually "Fl(2) W R" -> White 2 flashes, Red 2 flashes? Or White then Red?
          // Spec: "Fl(n) ... 色トークンを記述順に消費"
          // So Fl(2) W R -> W W (gap) R R (gap)?
          // Or W R (gap)?
          // Spec: "Fl(2+1) W G ... 白を 2 回点滅 → 緑を 1 回点滅"
          // So we consume color per GROUP of flashes defined by count?
          // "Fl(2) W R" -> W(2) -> R(2)?
          // Let's assume color changes per "count group".
          
          // However, standard Fl(2) is one group of 2 flashes.
          // If colors cycle, does it change per flash or per group?
          // Usually per period or per group.
          // Spec: "Fl(2+1) W G ... 白を 2 回点滅 → 緑を 1 回点滅"
          // This implies color changes per count-component.
          
          // Logic: Iterate over counts. For each count `c`, use next color.
          // Generate `c` flashes.
          // Then wait for eclipse.
          
          // Timing:
          // Period is total.
          // We need to fit everything in period.
          // But Fl timing is usually: Flash duration fixed (or ratio), Eclipse fills rest.
          // Spec: "周期を max(n, colorCount) で割ってスロット長を算出" (This is for simple Fl?)
          // "Gp Fl ... Fl(n) と同じ計算でスロットを区切りつつ ... セット間には 1〜2 スロット長ぶんの暗期"
          
          // Let's try to construct the timeline.
          // We have `counts` array (e.g. [2, 1]).
          // Total "slots" needed?
          // Each flash needs On + Off.
          // Gp Fl needs long eclipse between groups?
          // Spec is a bit complex here.
          // "Fl(n) ... 周期を max(n, colorCount) で割ってスロット長を算出"
          // This formula seems to apply to simple Fl or Al Fl.
          
          // Let's simplify:
          // 1. Calculate "Unit Slot" duration.
          //    If Gp Fl, we have multiple flashes.
          //    Let's assume a standard flash length (e.g. 0.5s or 1s) if period allows, or scale.
          //    Actually, let's follow the spec formula:
          //    Slot = Period / max(totalFlashes, colors.length)? No, that's for simple Fl.
          
          //    For Gp Fl(3) 15s:
          //    3 flashes.
          //    Maybe 1s per flash-cycle (0.3s on, 0.7s off) * 3 = 3s.
          //    Remaining 12s is eclipse.
          
          //    Let's use a standard flash duration logic.
          //    Flash ON = 0.3s (or less).
          //    Short Eclipse = 0.7s.
          //    Total flash cycle = 1.0s.
          //    If period is short, scale down.
          
          const totalFlashCount = counts.reduce((a, b) => a + b, 0);
          // Estimate time needed for flashes
          const baseFlashCycle = 1.0; // 1 sec per flash
          const longEclipse = 2.0; // Min eclipse
          
          // If period is provided, we fit within period.
          // If period is tight, we shrink.
          
          // Let's generate the pattern of On/Off durations relative to "1 unit".
          // Then scale to period.
          
          const pattern = [];
          let cIdx = 0;
          
          counts.forEach((count, idx) => {
            const color = effectiveColors[cIdx % effectiveColors.length];
            cIdx++;
            
            for (let i = 0; i < count; i++) {
              pattern.push({ on: true, weight: 0.3, color }); // Flash
              // If not last flash in group, short gap
              if (i < count - 1) {
                pattern.push({ on: false, weight: 0.7 });
              }
            }
            
            // After group, long gap?
            // If it's the last group, the remaining period is the gap.
            // If there are multiple groups (e.g. Fl(2+1)), we need a gap between them.
            if (idx < counts.length - 1) {
              pattern.push({ on: false, weight: 2.0 }); // Inter-group gap
            }
          });
          
          // Calculate total weight
          const totalWeight = pattern.reduce((sum, p) => sum + p.weight, 0);
          // Remaining weight for final eclipse
          // We want the "active" part to take some reasonable time, and the rest is eclipse.
          // But `period` is fixed.
          // If we map totalWeight to period, the flashes might be too slow.
          // We want flashes to be "flash-like" (short).
          // Usually flash is < 1s.
          // Let's assume 1 weight unit = 1 second roughly, but clamped.
          
          // Actually, let's just use the ratio if period is defined.
          // But for long periods (15s), Fl(1) shouldn't take 15s.
          // It should be Flash (0.5s) -> Eclipse (14.5s).
          
          // Strategy:
          // Define "Active Time" vs "Eclipse Time".
          // Active Time = (0.3 + 0.7) * flashes + gaps.
          // If Active Time < Period, pad the end.
          // If Active Time > Period, scale down.
          
          let timeScale = 1.0;
          const estimatedActive = totalWeight; // assuming 1 weight = 1 sec
          
          if (period) {
             if (estimatedActive > period) {
               timeScale = period / estimatedActive;
             }
             // If period is long, we keep timeScale = 1.0 (or close) and add trailing eclipse.
          }
          
          pattern.forEach(p => {
            sequence.push({
              on: p.on,
              duration: p.weight * timeScale,
              color: p.color || colors[0],
              intensity: 1
            });
          });
          
          // Add trailing eclipse
          const usedTime = pattern.reduce((sum, p) => sum + (p.weight * timeScale), 0);
          if (period && period > usedTime) {
            sequence.push({ on: false, duration: period - usedTime, color: colors[0], intensity: 0 });
          }
        }
        break;

      case "LFL":
        {
          // Long Flash: 80% ON (0.7-0.9), rest OFF.
          // Usually single flash.
          const color = colors[0];
          const onDur = safePeriod * 0.8;
          const offDur = safePeriod - onDur;
          sequence.push({ on: true, duration: onDur, color, intensity: 1 });
          sequence.push({ on: false, duration: offDur, color, intensity: 0 });
        }
        break;

      case "Q":
      case "VQ":
      case "UQ":
        {
          // Continuous quick flashes.
          // Q: 1s (1Hz)
          // VQ: 0.5s (2Hz)
          // UQ: 0.25s (4Hz)
          const cycle = type === "UQ" ? 0.25 : (type === "VQ" ? 0.5 : 1.0);
          // 60% ON? Spec says "Fl と同じ 60% 点灯比率"
          // But Fl is clamped to 0.3s. Q should also be short.
          // Q(1s) -> 0.6s is too long for "Quick".
          // We apply the same clamp logic: min(0.3, cycle * 0.6).
          const onDur = Math.min(0.3, cycle * 0.6);
          const offDur = cycle - onDur;
          
          // If period is specified (e.g. Q 10s?), it usually means it runs for that period?
          // Or Q(3) 10s?
          // If param is present (e.g. Q(3)), it's Group Quick?
          // Spec: "Q(3) ... IQ ... IQ はグループの最後に 3〜5 スロットぶんの長め暗期"
          // Wait, Q(3) is usually Gp Q? Or IQ?
          // Spec says "Q / VQ / UQ / IQ".
          // If param exists, treat as Group/Interrupted.
          
          const counts = parseCount(param); // e.g. [3] or [9]
          const isGroup = !!param;
          
          if (isGroup) {
             // IQ logic
             // Generate N flashes then eclipse.
             // Fit in period?
             const count = counts[0];
             const activeDur = count * cycle;
             let eclipse = 0;
             if (period) {
               eclipse = Math.max(0, period - activeDur);
             } else {
               eclipse = cycle * 4; // Default gap
             }
             
             for(let i=0; i<count; i++) {
               sequence.push({ on: true, duration: onDur, color: colors[0], intensity: 1 });
               sequence.push({ on: false, duration: offDur, color: colors[0], intensity: 0 });
             }
             // Adjust last offDur to be eclipse?
             // Actually the loop adds `offDur` after each ON.
             // So we have `count` cycles.
             // The eclipse is added after.
             sequence.push({ on: false, duration: eclipse, color: colors[0], intensity: 0 });
          } else {
             // Continuous
             // Just one cycle, repeated by simulator loop
             sequence.push({ on: true, duration: onDur, color: colors[0], intensity: 1 });
             sequence.push({ on: false, duration: offDur, color: colors[0], intensity: 0 });
          }
        }
        break;
        
      case "IQ":
        {
           // Interrupted Quick. Similar to Q(n).
           // Usually IQ without count means ...?
           // Spec: "IQ W ... IQ はグループの最後に 3〜5 スロットぶんの長め暗期"
           // If count not specified, maybe default to some number? Or just run for a while then stop?
           // Usually IQ is defined like "IQ 9 15s" (9 flashes every 15s).
           // Let's assume param is required or default to 9.
           const count = param ? parseInt(param) : 9;
           const cycle = 1.0; // Q speed
           const onDur = cycle * 0.6;
           const offDur = cycle * 0.4;
           
           for(let i=0; i<count; i++) {
             sequence.push({ on: true, duration: onDur, color: colors[0], intensity: 1 });
             sequence.push({ on: false, duration: offDur, color: colors[0], intensity: 0 });
           }
           const used = count * cycle;
           const eclipse = (period && period > used) ? (period - used) : (cycle * 4);
           sequence.push({ on: false, duration: eclipse, color: colors[0], intensity: 0 });
        }
        break;

      case "OC":
      case "GP OC":
        {
          // Oc: 25% ON, 75% OFF (Spec).
          // Gp Oc: Groups of Oc.
          // Wait, if Oc is 25% ON, it looks like a Flash.
          // Standard Oc is >50% ON.
          // Spec: "周期の 25% が点灯、75% が消灯"
          // I will follow spec.
          
          const counts = parseCount(param);
          const total = getTotalCount(counts);
          
          // If single Oc (no param), count=1.
          // Logic similar to Fl but different ratio.
          // And "原則単色".
          
          // If Gp Oc, we have groups.
          // Spec: "セットごとに暗期を slotLength〜2 * slotLength ... で挿入"
          
          // Let's define "Slot" as the cycle of one Oc pulse.
          // If period is given, and we have N pulses + gaps...
          // It's hard to determine "Slot Length" from Period if we have variable gaps.
          // But usually Oc(2) 8s means: ON-OFF-ON-OFF... fitting in 8s.
          // If it's "Group", there's a longer eclipse.
          
          // Let's assume a base slot length derived from period / (count + padding).
          // Padding for group gap.
          // e.g. Oc(2): 2 slots + 1 slot gap = 3 slots total?
          // Slot = Period / 3.
          
          const groupGapSlots = 1.0; // 1 slot equivalent
          const totalSlots = total + (counts.length * groupGapSlots); // Rough estimate
          
          const slotDur = safePeriod / totalSlots;
          const onDur = slotDur * 0.25;
          const offDur = slotDur * 0.75;
          
          counts.forEach((count, idx) => {
             for(let i=0; i<count; i++) {
               sequence.push({ on: true, duration: onDur, color: colors[0], intensity: 1 });
               sequence.push({ on: false, duration: offDur, color: colors[0], intensity: 0 });
             }
             // Group gap (already included in offDur? No, offDur is part of cycle)
             // We need EXTRA gap?
             // "セットごとに暗期を ... 挿入"
             // If we just run the cycles, we have short OFFs.
             // We want a LONG OFF after the group.
             // But wait, if Oc is 25% ON, 75% OFF, the OFF is already long.
             // Maybe the "Group Gap" is just the standard OFF?
             // No, "Gp Oc" implies distinct groups.
             // So the gap between groups must be longer than the gap between pulses.
             // But 75% OFF is already quite long.
             // Maybe the spec implies the "ON" part is the "Occulting" part?
             // "明暗灯（減光灯）" -> Usually Light is dominant. Dark is short.
             // If spec says "25% ON", it contradicts "明暗灯".
             // "明暗灯" = Light > Dark.
             // "25% ON" = Light < Dark.
             // This is a contradiction in the spec text vs standard term.
             // However, I must follow the text "25% が点灯".
             // If so, it behaves like a Flash.
             // I will implement as specified: 25% ON.
             
             if (idx < counts.length - 1 || (counts.length === 1 && param)) {
                // Add extra gap
                sequence.push({ on: false, duration: slotDur, color: colors[0], intensity: 0 });
             }
          });
          
          // Fill remaining period if any (for single group case)
          // ...
        }
        break;

      case "ISO":
        {
          // 50% ON, 50% OFF.
          const onDur = safePeriod / 2;
          sequence.push({ on: true, duration: onDur, color: colors[0], intensity: 1 });
          sequence.push({ on: false, duration: onDur, color: colors[0], intensity: 0 });
        }
        break;

      case "AL FL":
      case "AL OC":
      case "AL ISO":
      case "AL":
        {
          // Alternating.
          // Al Fl: Alternating Flashes.
          // Al Iso: Alternating Iso.
          // Al Oc: Alternating Oc.
          
          const subType = type.replace("AL", "").trim() || "ISO"; // Default to Iso if just "Al"? Or Fl?
          
          const counts = parseCount(param); // e.g. [2, 1] for Fl(2+1)
          
          // Spec: "1 セットを 1 スロットとして扱い、色のまとまり単位で順番を進めます"
          // So we divide period by the number of color groups (counts.length).
          const slots = counts.length > 1 ? counts : new Array(colors.length).fill(1);
          const numSlots = slots.length;
          const slotDur = safePeriod / numSlots;
          
          let cIdx = 0;
          slots.forEach(count => {
            const color = colors[cIdx % colors.length];
            cIdx++;
            
            // Generate `count` cycles of the sub-type for this color within `slotDur`.
            
            if (subType.includes("FL")) {
                 // Flash pattern: Short flashes.
                 // If count > 1, we treat it as a group of flashes within the slot.
                 // Flash duration: max 0.3s.
                 // Interval: 1.0s (standard) or scaled if slot is tight.
                 
                 const flashDur = 0.3; // Fixed short flash target
                 const interval = 1.0; // Standard interval for group
                 
                 // Check if we can fit `count` flashes with 1s interval in `slotDur`.
                 // If slotDur is very short, we might need to scale down.
                 // But usually Al Fl has long periods.
                 
                 for(let i=0; i<count; i++) {
                    // Calculate ON duration: min(0.3, slotDur * 0.6) if single?
                    // But here we use fixed 0.3s if possible.
                    // If slotDur is super short (e.g. 0.5s), 0.3s might be too long if count=1.
                    // Let's use min(0.3, slotDur/count * 0.6).
                    
                    const maxOn = (slotDur / count) * 0.6;
                    const on = Math.min(0.3, Math.max(0.05, maxOn));
                    
                    sequence.push({ on: true, duration: on, color, intensity: 1 });
                    
                    // Gap
                    if (i < count - 1) {
                        // Short gap between flashes in group
                        // Standard gap = 0.7s (to make 1s cycle).
                        // But we must fit in slotDur.
                        // If we just push 0.7s, we might exceed slotDur.
                        // Let's just use 0.7s.
                        sequence.push({ on: false, duration: 0.7, color, intensity: 0 });
                    } else {
                        // Last flash in group. Fill rest of slot.
                        // Calculate used time so far.
                        // (count-1) * (on + 0.7) + on.
                        // Wait, `on` might vary if we used maxOn.
                        // Let's assume `on` is constant for this slot.
                        const used = (count - 1) * (on + 0.7) + on;
                        const remaining = slotDur - used;
                        sequence.push({ on: false, duration: Math.max(0, remaining), color, intensity: 0 });
                    }
                 }
            } else if (subType.includes("OC")) {
                 // Oc pattern (25% on)
                 // Repeat `count` times evenly in slotDur.
                 const cycleDur = slotDur / count;
                 const on = cycleDur * 0.25;
                 const off = cycleDur * 0.75;
                 for(let i=0; i<count; i++) {
                    sequence.push({ on: true, duration: on, color, intensity: 1 });
                    sequence.push({ on: false, duration: off, color, intensity: 0 });
                 }
            } else {
                 // Iso or default Al
                 // Repeat `count` times evenly.
                 const cycleDur = slotDur / count;
                 // Spec: gap = min(slot * 0.1, 0.2)
                 const gap = Math.min(cycleDur * 0.1, 0.2);
                 const on = cycleDur - gap;
                 for(let i=0; i<count; i++) {
                    sequence.push({ on: true, duration: on, color, intensity: 1 });
                    sequence.push({ on: false, duration: gap, color, intensity: 0 });
                 }
            }
          });
        }
        break;

      case "FFL":
      case "FL F":
        {
          // Fixed and Flashing.
          // Background: Fixed Color (Intensity 0.5 or 1?)
          // Flash: Brighter (Intensity 1?)
          // Or same intensity, just "Flash" on top?
          // Usually FFl is: Fixed light, with brighter flashes.
          // We'll simulate by:
          // Eclipse part of Flash = Fixed Light (ON).
          // Flash part = Flash (ON).
          // So it's ALWAYS ON.
          // But we need to visualize the flash.
          // We'll use `intensity` 1.0 for flash, 0.4 for fixed.
          
          const onDur = safePeriod * 0.1; // Short flash
          const fixedDur = safePeriod - onDur;
          
          sequence.push({ on: true, duration: onDur, color: colors[0], intensity: 1.0 });
          sequence.push({ on: true, duration: fixedDur, color: colors[0], intensity: 0.4 });
        }
        break;

      case "MO":
        {
          // Morse.
          // Need morse map.
          const char = param || "A";
          // We assume `morseCodeMap` is available globally or we define a minimal one.
          // Let's define minimal here to be safe or use window.
          const codeStr = (window.morseCodeMap && window.morseCodeMap[char]) || ".-"; // Default A
          
          // Dot = 1 unit. Dash = 3 units.
          // Gap (intra-char) = 1 unit.
          // Gap (inter-char) = 3 units. (If multiple chars)
          // Gap (word) = 7 units. (At end of period?)
          
          // Parse codeStr ".-"
          const units = [];
          for(let c of codeStr) {
            if (c === '.') {
              units.push({ on: true, len: 1 });
            } else if (c === '-') {
              units.push({ on: true, len: 3 });
            }
            units.push({ on: false, len: 1 }); // Gap after symbol
          }
          // Remove last gap? No, usually needed.
          
          // Calculate total units
          const totalUnits = units.reduce((s, u) => s + u.len, 0) + 6; // +6 for trailing gap (7-1)?
          
          const unitTime = safePeriod / totalUnits;
          const clampedUnit = Math.max(0.05, unitTime);
          
          units.forEach(u => {
            sequence.push({ on: u.on, duration: u.len * clampedUnit, color: colors[0], intensity: 1 });
          });
          // Trailing gap
          const used = units.reduce((s, u) => s + u.len * clampedUnit, 0);
          if (safePeriod > used) {
            sequence.push({ on: false, duration: safePeriod - used, color: colors[0], intensity: 0 });
          }
        }
        break;

      default:
        // Unknown, default to F?
        sequence.push({ on: true, duration: safePeriod, color: colors[0], intensity: 1 });
        break;
    }

    return sequence;
  }

  exports.parseLightCode = parseLightCode;
  exports.generateSequence = generateSequence;
  exports.colorMap = colorMap;

})(window.LighthouseSim);

(() => {
  const select = document.getElementById("lighthouseSelect");
  const info = document.getElementById("info");
  const light = document.getElementById("light");
  const { parseLightCode, generateSequence, colorMap } = window.LighthouseSim;

  if (!select || !info || !light) return;

  if (typeof lighthouses === "undefined" || !Array.isArray(lighthouses)) {
    console.error("灯台データが正しく読み込まれていません。");
    return;
  }

  let simulationTimer = null;

  function populateSelect() {
    Array.from(select.querySelectorAll("option")).forEach((opt, idx) => {
      if (idx !== 0) opt.remove();
    });
    lighthouses.forEach((lh, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = lh.name;
      select.appendChild(opt);
    });
    select.value = "";
  }

  function resetLight() {
    light.style.backgroundColor = "black";
    light.style.boxShadow = "none";
    light.style.borderColor = "#333";
  }

  function updateInfo() {
    if (!select.value) {
      info.textContent = "";
      resetLight();
      return;
    }
    const index = Number(select.value);
    if (Number.isNaN(index) || !lighthouses[index]) {
      info.textContent = "";
      resetLight();
      return;
    }
    const { name, code, range } = lighthouses[index];
    info.textContent = `${name}：灯質 ${code}、光達距離 ${range}`;
    simulate(code);
  }

  function simulate(code) {
    if (simulationTimer) {
      clearTimeout(simulationTimer);
      simulationTimer = null;
    }

    const parsed = parseLightCode(code);
    if (!parsed) {
      resetLight();
      return;
    }

    const sequence = generateSequence(parsed);
    if (!sequence.length) {
      resetLight();
      return;
    }

    let index = 0;
    const step = () => {
      const state = sequence[index];
      const cssColor = state.on ? (colorMap[state.color] || "white") : "black";
      
      light.style.backgroundColor = state.on ? cssColor : "black";
      if (state.on) {
        // Adjust opacity/size based on intensity?
        // For FFl, intensity 0.4 vs 1.0
        const opacity = state.intensity || 1;
        const spread = 40 * opacity;
        light.style.boxShadow = `0 0 ${spread}px ${15 * opacity}px ${cssColor}`;
        light.style.borderColor = cssColor;
        light.style.opacity = opacity; // Simple intensity simulation
      } else {
        light.style.boxShadow = "none";
        light.style.borderColor = "#333";
        light.style.opacity = 1;
      }

      simulationTimer = setTimeout(() => {
        index = (index + 1) % sequence.length;
        step();
      }, state.duration * 1000);
    };

    step();
  }

  populateSelect();
  select.disabled = false;
  select.addEventListener("change", updateInfo);
  resetLight();
})();

(() => {
  const mapContainer = document.getElementById("map");
  if (!mapContainer) return;
  if (typeof L === "undefined") return;
  if (typeof lighthouses === "undefined") return;

  const { parseLightCode, generateSequence, colorMap } = window.LighthouseSim;
  const map = L.map("map").setView([34.7, 138.5], 8);

  // ... (Tile layers and map setup unchanged) ...
  const tileSources = {
    "標準": "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
    "淡色": "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",
    "写真": "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg"
  };
  const baseLayers = {};
  Object.entries(tileSources).forEach(([label, url]) => {
    baseLayers[label] = L.tileLayer(url, {
      attribution: "<a href='https://maps.gsi.go.jp/development/ichiran.html'>地理院地図</a>",
      maxZoom: 18
    });
  });
  baseLayers["淡色"].addTo(map);
  L.control.layers(baseLayers, null, { position: "topleft", collapsed: false }).addTo(map);

  const coordinateText = document.getElementById("coordinateText");
  const copyButton = document.getElementById("copyCoordsButton");
  let lastCoordinates = null;

  map.on("click", (event) => {
    const { lat, lng } = event.latlng;
    const latFixed = lat.toFixed(6);
    const lngFixed = lng.toFixed(6);
    if (coordinateText) coordinateText.textContent = `緯度: ${latFixed} / 経度: ${lngFixed}`;
    lastCoordinates = { lat: latFixed, lng: lngFixed };
    if (copyButton) copyButton.disabled = false;
  });

  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      if (!lastCoordinates) return;
      const formatted = `lat: ${lastCoordinates.lat}, lon: ${lastCoordinates.lng}`;
      try {
        await navigator.clipboard.writeText(formatted);
        copyButton.textContent = "コピーしました";
        setTimeout(() => { copyButton.textContent = "座標コピー"; copyButton.disabled = false; }, 1500);
      } catch (e) {
        console.error(e);
      }
    });
  }

  const popupSimulations = new Map();
  const rangeOverlays = new Map();
  const NM_TO_METERS = 1852;
  const EARTH_RADIUS = 6371000;

  // ... (Helper functions: parseRangeMeters, addRangeCircle, toRadians, toDegrees, destinationPoint, buildSectorPolygon) ...
  function parseRangeMeters(rangeNm) {
    const numericRange = typeof rangeNm === "number" ? rangeNm : parseFloat(rangeNm);
    if (!Number.isFinite(numericRange) || numericRange <= 0) return null;
    return numericRange * NM_TO_METERS;
  }
  function addRangeCircle(position, radiusMeters, color) {
    const circle = L.circle(position, { radius: radiusMeters, color, weight: 1.5, opacity: 0, fillColor: color, fillOpacity: 0.3 }).addTo(map);
    circle.bringToBack();
    return circle;
  }
  function toRadians(d) { return d * Math.PI / 180; }
  function toDegrees(r) { return r * 180 / Math.PI; }
  function destinationPoint(lat, lon, bearingDeg, distanceMeters) {
    const angularDistance = distanceMeters / EARTH_RADIUS;
    const bearingRad = toRadians(bearingDeg);
    const latRad = toRadians(lat);
    const lonRad = toRadians(lon);
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const sinAngular = Math.sin(angularDistance);
    const cosAngular = Math.cos(angularDistance);
    const sinLat2 = sinLat * cosAngular + cosLat * sinAngular * Math.cos(bearingRad);
    const lat2 = Math.asin(Math.min(Math.max(sinLat2, -1), 1));
    const y = Math.sin(bearingRad) * sinAngular * cosLat;
    const x = cosAngular - sinLat * sinLat2;
    const lon2 = lonRad + Math.atan2(y, x);
    return [toDegrees(lat2), ((toDegrees(lon2) + 540) % 360) - 180];
  }
  function buildSectorPolygon(position, radiusMeters, startDeg, endDeg) {
    if (!Number.isFinite(radiusMeters)) return null;
    const [lat, lon] = position;
    let start = ((startDeg % 360) + 360) % 360;
    let end = ((endDeg % 360) + 360) % 360;
    let sweep = end - start;
    if (sweep <= 0) sweep += 360;
    if (sweep >= 359) return null;
    const steps = Math.max(2, Math.ceil(sweep / 5));
    const stepSize = sweep / steps;
    const points = [[lat, lon]];
    for (let i = 0; i <= steps; i++) {
      const bearing = (start + stepSize * i) % 360;
      const [dLat, dLon] = destinationPoint(lat, lon, bearing, radiusMeters);
      points.push([dLat, dLon]);
    }
    points.push([lat, lon]);
    return points;
  }

  function showRangeOverlays(lightId, position, radiusMeters, arcs, fallbackColor) {
    hideRangeOverlays(lightId);
    if (!radiusMeters) return;
    const overlays = [];
    if (Array.isArray(arcs) && arcs.length > 0) {
      arcs.forEach(arc => {
        const start = Number(arc.start);
        const end = Number(arc.end);
        const token = arc.color;
        const cssColor = colorMap[token] || fallbackColor || "gray";
        if (!Number.isFinite(start) || !Number.isFinite(end)) return;
        let sweep = ((end - start) % 360 + 360) % 360;
        if (sweep === 0) sweep = 360;
        if (sweep >= 359) {
          if (overlays.length === 0) overlays.push(addRangeCircle(position, radiusMeters, cssColor));
          return;
        }
        const polyPoints = buildSectorPolygon(position, radiusMeters, start, end);
        if (polyPoints) {
          const poly = L.polygon(polyPoints, { color: cssColor, weight: 1.5, opacity: 0.6, fillColor: cssColor, fillOpacity: 0.15 }).addTo(map);
          poly.bringToBack();
          overlays.push(poly);
        }
      });
    }
    if (overlays.length === 0) {
      overlays.push(addRangeCircle(position, radiusMeters, fallbackColor || "gray"));
    }
    rangeOverlays.set(lightId, overlays);
  }

  function hideRangeOverlays(lightId) {
    const overlays = rangeOverlays.get(lightId);
    if (overlays) {
      overlays.forEach(l => map.removeLayer(l));
      rangeOverlays.delete(lightId);
    }
  }

  function extractColor(code) {
    const parsed = parseLightCode(code);
    if (!parsed || !parsed.colors.length) return "W";
    // If multiple colors, return mixed or first?
    // For map marker, maybe mixed color if simultaneous?
    // Or just first.
    // Previous logic: W/R/G
    if (parsed.colors.length > 1) return parsed.colors.join("/");
    return parsed.colors[0];
  }

  function resetPopupLight(lightEl) {
    if (!lightEl) return;
    lightEl.style.backgroundColor = "black";
    lightEl.style.boxShadow = "none";
    lightEl.style.borderColor = "#333";
    lightEl.style.opacity = 1;
  }

  function stopPopupSimulation(lightId) {
    const sim = popupSimulations.get(lightId);
    if (sim) {
      clearTimeout(sim.timer);
      resetPopupLight(sim.lightEl);
      popupSimulations.delete(lightId);
    }
  }

  function startPopupSimulation(lightId, code) {
    stopPopupSimulation(lightId);
    const lightEl = document.getElementById(lightId);
    if (!lightEl) return;

    const parsed = parseLightCode(code);
    if (!parsed) {
      resetPopupLight(lightEl);
      return;
    }
    const sequence = generateSequence(parsed);
    if (!sequence.length) {
      resetPopupLight(lightEl);
      return;
    }

    let index = 0;
    const sim = { lightEl, timer: null };
    
    const step = () => {
      const state = sequence[index];
      const cssColor = state.on ? (colorMap[state.color] || "white") : "black";
      
      lightEl.style.backgroundColor = state.on ? cssColor : "black";
      if (state.on) {
        const opacity = state.intensity || 1;
        const spread = 16 * opacity;
        lightEl.style.boxShadow = `0 0 ${spread}px ${6 * opacity}px ${cssColor}`;
        lightEl.style.borderColor = cssColor;
        lightEl.style.opacity = opacity;
      } else {
        lightEl.style.boxShadow = "none";
        lightEl.style.borderColor = "#333";
        lightEl.style.opacity = 1;
      }

      sim.timer = setTimeout(() => {
        index = (index + 1) % sequence.length;
        step();
      }, state.duration * 1000);
    };

    resetPopupLight(lightEl);
    step();
    popupSimulations.set(lightId, sim);
  }

  function plotLighthouses() {
    const points = lighthouses.filter(lh => typeof lh.lat === "number" && typeof lh.lon === "number");
    if (points.length === 0) {
      const msg = document.createElement("p");
      msg.textContent = "灯台データが見つかりません。";
      document.body.appendChild(msg);
      return;
    }

    let idx = 0;
    points.forEach(lh => {
      const colorKey = extractColor(lh.code);
      const color = colorMap[colorKey] || "gray";
      const lightId = `popup-light-${idx}`;
      const rangeMeters = parseRangeMeters(lh.range);

      const marker = L.circleMarker([lh.lat, lh.lon], {
        radius: 6, weight: 2, color: "gray", fillColor: color, fillOpacity: 0.8
      }).addTo(map);

      marker.bindPopup(`
        <div class="popup-content">
          <div style="text-align: center; margin-bottom: 4px;"><strong>${lh.name}</strong></div>
          <div>灯質: ${lh.code}</div>
          <div>光達距離: ${lh.range} 海里</div>
          <div class="popup-light-wrapper">
            <div id="${lightId}" class="popup-light"></div>
          </div>
        </div>
      `, { minWidth: 180 });

      marker.on("click", () => {
        const latFixed = lh.lat.toFixed(6);
        const lngFixed = lh.lon.toFixed(6);
        if (coordinateText) coordinateText.textContent = `緯度: ${latFixed} / 経度: ${lngFixed}`;
        lastCoordinates = { lat: latFixed, lng: lngFixed };
        if (copyButton) copyButton.disabled = false;
      });

      marker.on("popupopen", () => {
        startPopupSimulation(lightId, lh.code);
        showRangeOverlays(lightId, [lh.lat, lh.lon], rangeMeters, lh.arcs, color);
      });
      marker.on("popupclose", () => {
        stopPopupSimulation(lightId);
        hideRangeOverlays(lightId);
      });
      idx++;
    });
  }

  plotLighthouses();
})();
