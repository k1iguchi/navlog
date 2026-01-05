// Lighthouse Simulation Logic
// Shared logic for light code parsing and sequence generation

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

  // ========== Helper Functions ==========
  function parseCount(p) {
    if (!p) return [1];
    if (p.includes("+")) return p.split("+").map(Number);
    return [parseInt(p, 10)];
  }

  function getTotalCount(counts) {
    return counts.reduce((a, b) => a + b, 0);
  }

  // ========== Type Handlers ==========
  function handleFixed(colors, period, isContinuous) {
    const sequence = [];
    if (isContinuous) {
      const duration = 3.0;
      for (let i = 0; i < colors.length; i++) {
        sequence.push({ on: true, duration, color: colors[i], intensity: 1 });
      }
    } else {
      const duration = period ? period / colors.length : 3.0;
      for (let i = 0; i < colors.length; i++) {
        sequence.push({ on: true, duration, color: colors[i], intensity: 1 });
      }
    }
    return sequence;
  }

  function handleFlash(type, param, colors, period) {
    const sequence = [];
    const counts = parseCount(param);
    const totalFlashes = getTotalCount(counts);
    
    let effectiveColors = [...colors];
    if (type === "FL" && totalFlashes === 1 && colors.length > 1) {
      effectiveColors = [colors.join("/")];
    }

    const pattern = [];
    let cIdx = 0;
    
    counts.forEach((count, idx) => {
      const color = effectiveColors[cIdx % effectiveColors.length];
      cIdx++;
      
      for (let i = 0; i < count; i++) {
        pattern.push({ on: true, weight: 0.3, color });
        if (i < count - 1) {
          pattern.push({ on: false, weight: 0.7 });
        }
      }
      
      if (idx < counts.length - 1) {
        pattern.push({ on: false, weight: 2.0 });
      }
    });
    
    const totalWeight = pattern.reduce((sum, p) => sum + p.weight, 0);
    let timeScale = 1.0;
    
    if (period && totalWeight > period) {
      timeScale = period / totalWeight;
    }
    
    pattern.forEach(p => {
      sequence.push({
        on: p.on,
        duration: p.weight * timeScale,
        color: p.color || colors[0],
        intensity: 1
      });
    });
    
    const usedTime = pattern.reduce((sum, p) => sum + (p.weight * timeScale), 0);
    if (period && period > usedTime) {
      sequence.push({ on: false, duration: period - usedTime, color: colors[0], intensity: 0 });
    }
    
    return sequence;
  }

  function handleLongFlash(colors, safePeriod) {
    const color = colors[0];
    const onDur = safePeriod * 0.8;
    const offDur = safePeriod - onDur;
    return [
      { on: true, duration: onDur, color, intensity: 1 },
      { on: false, duration: offDur, color, intensity: 0 }
    ];
  }

  function handleQuick(type, param, colors, period) {
    const sequence = [];
    const cycle = type === "UQ" ? 0.25 : (type === "VQ" ? 0.5 : 1.0);
    const onDur = Math.min(0.3, cycle * 0.6);
    const offDur = cycle - onDur;
    
    const counts = parseCount(param);
    const isGroup = !!param;
    
    if (isGroup) {
      const count = counts[0];
      const activeDur = count * cycle;
      let eclipse = period ? Math.max(0, period - activeDur) : cycle * 4;
      
      for (let i = 0; i < count; i++) {
        sequence.push({ on: true, duration: onDur, color: colors[0], intensity: 1 });
        sequence.push({ on: false, duration: offDur, color: colors[0], intensity: 0 });
      }
      sequence.push({ on: false, duration: eclipse, color: colors[0], intensity: 0 });
    } else {
      sequence.push({ on: true, duration: onDur, color: colors[0], intensity: 1 });
      sequence.push({ on: false, duration: offDur, color: colors[0], intensity: 0 });
    }
    
    return sequence;
  }

  function handleInterruptedQuick(param, colors, period) {
    const sequence = [];
    const count = param ? parseInt(param) : 9;
    const cycle = 1.0;
    const onDur = cycle * 0.6;
    const offDur = cycle * 0.4;
    
    for (let i = 0; i < count; i++) {
      sequence.push({ on: true, duration: onDur, color: colors[0], intensity: 1 });
      sequence.push({ on: false, duration: offDur, color: colors[0], intensity: 0 });
    }
    
    const used = count * cycle;
    const eclipse = (period && period > used) ? (period - used) : (cycle * 4);
    sequence.push({ on: false, duration: eclipse, color: colors[0], intensity: 0 });
    
    return sequence;
  }

  function handleOcculting(param, colors, safePeriod) {
    const sequence = [];
    const counts = parseCount(param);
    const total = getTotalCount(counts);
    
    const groupGapSlots = 1.0;
    const totalSlots = total + (counts.length * groupGapSlots);
    
    const slotDur = safePeriod / totalSlots;
    const onDur = slotDur * 0.25;
    const offDur = slotDur * 0.75;
    
    counts.forEach((count, idx) => {
      for (let i = 0; i < count; i++) {
        sequence.push({ on: true, duration: onDur, color: colors[0], intensity: 1 });
        sequence.push({ on: false, duration: offDur, color: colors[0], intensity: 0 });
      }
      
      if (idx < counts.length - 1 || (counts.length === 1 && param)) {
        sequence.push({ on: false, duration: slotDur, color: colors[0], intensity: 0 });
      }
    });
    
    return sequence;
  }

  function handleIsophase(colors, safePeriod) {
    const onDur = safePeriod / 2;
    return [
      { on: true, duration: onDur, color: colors[0], intensity: 1 },
      { on: false, duration: onDur, color: colors[0], intensity: 0 }
    ];
  }

  function handleAlternating(type, param, colors, safePeriod) {
    const sequence = [];
    const subType = type.replace("AL", "").trim() || "ISO";
    const counts = parseCount(param);
    
    const slots = counts.length > 1 ? counts : new Array(colors.length).fill(1);
    const numSlots = slots.length;
    const slotDur = safePeriod / numSlots;
    
    let cIdx = 0;
    slots.forEach(count => {
      const color = colors[cIdx % colors.length];
      cIdx++;
      
      if (subType.includes("FL")) {
        for (let i = 0; i < count; i++) {
          const maxOn = (slotDur / count) * 0.6;
          const on = Math.min(0.3, Math.max(0.05, maxOn));
          
          sequence.push({ on: true, duration: on, color, intensity: 1 });
          
          if (i < count - 1) {
            sequence.push({ on: false, duration: 0.7, color, intensity: 0 });
          } else {
            const used = (count - 1) * (on + 0.7) + on;
            const remaining = slotDur - used;
            sequence.push({ on: false, duration: Math.max(0, remaining), color, intensity: 0 });
          }
        }
      } else if (subType.includes("OC")) {
        const cycleDur = slotDur / count;
        const on = cycleDur * 0.25;
        const off = cycleDur * 0.75;
        for (let i = 0; i < count; i++) {
          sequence.push({ on: true, duration: on, color, intensity: 1 });
          sequence.push({ on: false, duration: off, color, intensity: 0 });
        }
      } else {
        const cycleDur = slotDur / count;
        const gap = Math.min(cycleDur * 0.1, 0.2);
        const on = cycleDur - gap;
        for (let i = 0; i < count; i++) {
          sequence.push({ on: true, duration: on, color, intensity: 1 });
          sequence.push({ on: false, duration: gap, color, intensity: 0 });
        }
      }
    });
    
    return sequence;
  }

  function handleFixedFlashing(colors, safePeriod) {
    const onDur = safePeriod * 0.1;
    const fixedDur = safePeriod - onDur;
    return [
      { on: true, duration: onDur, color: colors[0], intensity: 1.0 },
      { on: true, duration: fixedDur, color: colors[0], intensity: 0.4 }
    ];
  }

  function handleMorse(param, colors, safePeriod) {
    const sequence = [];
    const char = param || "A";
    const codeStr = (window.morseCodeMap && window.morseCodeMap[char]) || ".-";
    
    const units = [];
    for (let c of codeStr) {
      if (c === '.') {
        units.push({ on: true, len: 1 });
      } else if (c === '-') {
        units.push({ on: true, len: 3 });
      }
      units.push({ on: false, len: 1 });
    }
    
    const totalUnits = units.reduce((s, u) => s + u.len, 0) + 6;
    const unitTime = safePeriod / totalUnits;
    const clampedUnit = Math.max(0.05, unitTime);
    
    units.forEach(u => {
      sequence.push({ on: u.on, duration: u.len * clampedUnit, color: colors[0], intensity: 1 });
    });
    
    const used = units.reduce((s, u) => s + u.len * clampedUnit, 0);
    if (safePeriod > used) {
      sequence.push({ on: false, duration: safePeriod - used, color: colors[0], intensity: 0 });
    }
    
    return sequence;
  }

  // ========== Type Handler Map ==========
  const typeHandlers = {
    "F": (ctx) => handleFixed(ctx.colors, ctx.period, ctx.isContinuous),
    "DIR": (ctx) => handleFixed(ctx.colors, ctx.period, ctx.isContinuous),
    "DIR F": (ctx) => handleFixed(ctx.colors, ctx.period, ctx.isContinuous),
    "FL": (ctx) => handleFlash("FL", ctx.param, ctx.colors, ctx.period),
    "GP FL": (ctx) => handleFlash("GP FL", ctx.param, ctx.colors, ctx.period),
    "LFL": (ctx) => handleLongFlash(ctx.colors, ctx.safePeriod),
    "Q": (ctx) => handleQuick("Q", ctx.param, ctx.colors, ctx.period),
    "VQ": (ctx) => handleQuick("VQ", ctx.param, ctx.colors, ctx.period),
    "UQ": (ctx) => handleQuick("UQ", ctx.param, ctx.colors, ctx.period),
    "IQ": (ctx) => handleInterruptedQuick(ctx.param, ctx.colors, ctx.period),
    "OC": (ctx) => handleOcculting(ctx.param, ctx.colors, ctx.safePeriod),
    "GP OC": (ctx) => handleOcculting(ctx.param, ctx.colors, ctx.safePeriod),
    "ISO": (ctx) => handleIsophase(ctx.colors, ctx.safePeriod),
    "AL FL": (ctx) => handleAlternating("AL FL", ctx.param, ctx.colors, ctx.safePeriod),
    "AL OC": (ctx) => handleAlternating("AL OC", ctx.param, ctx.colors, ctx.safePeriod),
    "AL ISO": (ctx) => handleAlternating("AL ISO", ctx.param, ctx.colors, ctx.safePeriod),
    "AL": (ctx) => handleAlternating("AL", ctx.param, ctx.colors, ctx.safePeriod),
    "FFL": (ctx) => handleFixedFlashing(ctx.colors, ctx.safePeriod),
    "FL F": (ctx) => handleFixedFlashing(ctx.colors, ctx.safePeriod),
    "MO": (ctx) => handleMorse(ctx.param, ctx.colors, ctx.safePeriod)
  };

  // ========== Main Functions ==========
  function parseLightCode(code) {
    code = code.trim().replace(/\s+/g, " ");
    
    const regex = /^(?<type>Gp\s*Fl|Gp\s*Oc|Al\s*Fl|Al\s*Oc|Al\s*Iso|Fl\s*F|FFl|LFl|Iso|Oc|Fl|Mo|Q|VQ|UQ|IQ|Dir\s*F|Dir|F)(?:\((?<param>[^)]+)\))?\s+(?<colors>(?:[WRGY]|Am)+(?:\s+(?:[WRGY]|Am)+)*)(?:\s+(?<period>[\d.]+)s?)?$/i;
    
    const match = code.match(regex);
    if (!match) return null;

    const groups = match.groups;
    const type = groups.type.replace(/\s+/g, " ").toUpperCase();
    const param = groups.param || null;
    const colors = groups.colors.split(/\s+/).map(c => {
      const upper = c.toUpperCase();
      return upper === "AM" ? "Am" : upper;
    });
    const period = groups.period ? parseFloat(groups.period) : null;

    return { type, param, colors, period };
  }

  function generateSequence(parsed) {
    if (!parsed) return [];
    const { type, param, colors, period } = parsed;
    
    const isContinuous = (type === "DIR" || type === "DIR F" || type === "F") && !period;
    const safePeriod = period || 10;
    
    const ctx = { type, param, colors, period, isContinuous, safePeriod };
    
    const handler = typeHandlers[type];
    if (handler) {
      return handler(ctx);
    }
    
    return [{ on: true, duration: safePeriod, color: colors[0], intensity: 1 }];
  }

  function extractColor(code) {
    const parsed = parseLightCode(code);
    if (!parsed || !parsed.colors.length) return "W";
    if (parsed.colors.length > 1) return parsed.colors.join("/");
    return parsed.colors[0];
  }

  exports.parseLightCode = parseLightCode;
  exports.generateSequence = generateSequence;
  exports.extractColor = extractColor;
  exports.colorMap = colorMap;

})(window.LighthouseSim);
