function updateYAML() {
    const formData = { departure: {} };
    const rowDataArray = [];
    $('#navlog-table tr').each(function(index, row) {
        if (index === 1) { // 出発地行
            $(row).find('input, select').each(function() {
                const $input = $(this);
                const name = $input.attr('name');
                const value = $input.val();
                if (name && value) {
                    formData.departure[name] = $input.attr('type') === 'number' ? parseFloat(value) : value;
                }
            });
        } else if (index > 1 && !$(row).attr('id')) { // スキップする行: ヘッダーおよび合計行
            const rowData = {};
            $(row).find('input, select').each(function() {
                const $input = $(this);
                const name = $input.attr('name');
                const value = $input.val();
                // 計算で求められる項目および値が無い項目はYAMLに含めない
                if (name && value && !['wca', 'th', 'mh', 'ch', 'gs', 'ete', 'remDist', 'legDistance'].includes(name)) {
                    if ($input.attr('type') !== 'radio' || $input.is(':checked')) {
                        rowData[name] = $input.attr('type') === 'number' ? parseFloat(value) : value;
                    }
                }
            });
            rowDataArray.push(rowData);
        }
    });
    formData.checkpoints = rowDataArray;
    const yaml = jsyaml.dump(formData);
    $('#yaml-output').val(yaml);
}

function loadFormFromYAML() {
    const yamlText = $('#yaml-output').val();
    try {
        const formData = jsyaml.load(yamlText);

        // フォームをクリア
        $('#navlog-table tr').remove();

        createTableHeader(); // ヘッダー行の生成
        addDepartureRow(); // 出発地の行を追加
        createTotalRow(); // 合計行の生成

        Object.keys(formData.departure).forEach(name => {
            const $input = $(`#navlog-table tr:eq(1) [name="${name}"]`);
            $input.val(formData.departure[name]);
        });

        // 行を追加しつつ、入力値を設定
        formData.checkpoints.forEach((rowData, rowIndex) => {
            addRow();
            const $row = $('#navlog-table tr').eq(rowIndex + 2); // ヘッダーと出発地行を飛ばす
            Object.keys(rowData).forEach(name => {
                const $input = $row.find(`[name="${name}"]`);
                $input.val(rowData[name]);
                if ($input.attr('name') === 'pointType' && $input.val() === '変針点') {
                     $row.addClass('checkpoint-border');
                }
                if ($input.attr('name') === 'vorSign') {
                    updateMorseCode($input);
                }
            });
            calculateNavlog($row[0]);
        });

    } catch (e) {
        console.error('YAML読み込みエラー', e);
    }
}
