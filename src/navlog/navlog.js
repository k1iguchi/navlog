function calculateNavlog(row) {
    const $row = $(row);
    const rowIndex = $row.index();

    const getValue = (name, defaultValue = 0) => {
        let value = parseFloat($row.find(`input[name="${name}"]`).val());
        let $targetRow = $row;
        while (isNaN(value)) {
            $targetRow = $targetRow.prev('tr');
            if (!$targetRow || !$targetRow.length) {
                break;
            }
            value = parseFloat($targetRow.find(`input[name="${name}"]`).val());
        }
        return isNaN(value) ? defaultValue : value;
    };

    const tas = getValue('tas');
    const windSpeed = getValue('windSpeed', 0); // 未入力の場合は0ktとして扱う
    const windDirection = getValue('windDir', 0); // 未入力の場合は0度として扱う
    const tc = getValue('tc');
    const variation = getValue('var');
    const deviation = getValue('dev');
    const distance = getValue('distance');

    if (isNaN(tas) || isNaN(tc)) {
        return;
    }

    // 真のコース角度(TC)の変換
    const tcRad = tc * Math.PI / 180;

    // 風の角度と速度からの成分計算
    const windRad = windDirection * Math.PI / 180;
    const crosswind = windSpeed * Math.sin(windRad - tcRad);
    const headwind = windSpeed * Math.cos(windRad - tcRad);

    // 風修正角(WCA)の計算（四捨五入）
    let wca = Math.atan2(crosswind, tas + headwind) * 180 / Math.PI;
    wca = Math.round(wca);

    // 真の針路(TH)の計算（四捨五入）
    let trueHeading = tc + wca;
    trueHeading = Math.round(trueHeading);

    // 磁方位(MH)の計算（四捨五入）
    let magneticHeading = trueHeading + variation;
    magneticHeading = Math.round(magneticHeading);

    // 実用方位(CH)の計算（四捨五入）
    let compassHeading = magneticHeading + deviation;
    compassHeading = Math.round(compassHeading);

    // 地上速度(GS)の計算（切り捨て）
    let groundSpeed = tas - headwind;
    groundSpeed = Math.floor(groundSpeed);

    // 予定飛行時間の計算（分単位）
    let ete = !isNaN(distance) ? Math.round((distance / groundSpeed) * 60) : '';

    // 結果の表示と手動変更のためのinputボックスの設定
    $row.find('input[name="wca"]').val(wca);
    $row.find('input[name="th"]').val(trueHeading);
    $row.find('input[name="mh"]').val(magneticHeading);
    $row.find('input[name="ch"]').val(compassHeading);
    $row.find('input[name="gs"]').val(groundSpeed);
    $row.find('input[name="ete"]').val(ete);

    // 以降の行の残距離と区間総距離、区間総時間を再計算
    let totalRemDist = 0;
    let totallegDist = 0;
    let totalEte = 0;

    // 合計の更新
    updateTotals();
}

function updateTotals() {
    const $rows = $('#navlog-table tr').not('#total-row').get().reverse(); // 行を下から順に処理するために逆順に取得
    let legDist = 0;
    let totalDist = 0;
    let legEte = 0;
    let totalEte = 0;

    $rows.forEach(row => {
        const $row = $(row);
        const distance = parseFloat($row.find('input[name="distance"]').val()) || 0;
        const ete = parseFloat($row.find('input[name="ete"]').val()) || 0;

        if ($row.find('select[name="pointType"]').val() === '変針点') {
            legDist = 0;
            legEte = 0;
        }

        legDist += distance;
        totalDist += distance;
        legEte += ete;
        totalEte += ete;

        $row.find('input[name="remDist"]').val(totalDist);
        $row.find('input[name="legDistance"]').val(legDist);
        $row.find('input[name="legEte"]').val(legEte);
    });

    // 合計の表示更新（例：総距離、総ETEなど）
    $('#total-distance').text(totalDist.toFixed(0) + " nm");
    $('#total-ete').text(totalEte.toFixed(0) + " '");
}
