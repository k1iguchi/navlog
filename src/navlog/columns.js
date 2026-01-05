const columns = [
    { name: 'pointType',   type: 'select', header: '' },
    { name: 'name',        type: 'text',   header: '地点名' },
    { name: 'altitude',    type: 'alt',    header: '飛行高度' },
    { name: 'tas',         type: 'speed',  header: 'TAS' },
    { name: 'windDir',     type: 'dir',    header: '風向' },
    { name: 'windSpeed',   type: 'speed',  header: '風速' },
    { name: 'tc',          type: 'dir',    header: 'TC' },
    { name: 'wca',         type: 'ddir',   header: 'WCA' },
    { name: 'th',          type: 'dir',    header: 'TH' },
    { name: 'var',         type: 'ddir',   header: 'VAR',          default: 8 },
    { name: 'mh',          type: 'dir',    header: 'MH' },
    { name: 'dev',         type: 'ddir',   header: 'DEV',          default: 0 },
    { name: 'ch',          type: 'dir',    header: 'CH' },
    { name: 'gs',          type: 'speed',  header: 'GS' },
    { name: 'distance',    type: 'dist',   header: '距離' },
    { name: 'remDist',     type: 'dist',   header: '残距離' },
    { name: 'ete',         type: 'time',   header: 'ETE/ATE' },
    { name: 'eta',         type: 'none',   header: 'ETA/ATA' },
    { name: 'legDistance', type: 'dist',   header: '区間総距離' },
    { name: 'legEte',      type: 'time',   header: '区間総時間' },
    { name: 'fuel',        type: 'none',   header: '区間燃料/残燃料' },
    { name: 'vor',         type: 'freq',   header: 'VOR周波数',    extraInputSize: '5ch' },
    { name: 'rmk',         type: 'rmk',    header: '備考' }
];

const typeDefs = {
    select:   { unit: '',   inputSize: null },
    text:     { unit: '',   inputSize: '10ch' },
    alt:      { unit: '',   inputSize: '7ch' },
    speed:    { unit: ' kt', inputSize: '6ch' },
    dir:      { unit: ' °',  inputSize: '5ch' },
    ddir:     { unit: ' °',  inputSize: '4ch' },
    dist:     { unit: ' nm', inputSize: '5ch' },
    time:     { unit: " '", inputSize: '5ch' },
    none:     { unit: '',   inputSize: null },
    freq:     { unit: '',   inputSize: '7ch' },
    rmk:      { unit: '',   inputSize: '20ch' }
};
