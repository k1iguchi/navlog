function getUnit(type) {
    switch (type) {
        case 'speed':
            return ` kt`;
        case 'dir':
        case 'ddir':
            return ` °`;
        case 'dist':
            return ` nm`;
        case 'time':
            return ` '`;
        default:
            return '';
    }
}

function getInputSize(type) {
    switch (type) {
        case 'speed':
            return `6ch`;
        case 'dir':
            return `5ch`;
        case 'ddir':
            return `4ch`;
        case 'dist':
            return `5ch`;
        case 'time':
            return `5ch`;
        case 'freq':
            return `7ch`;
        case 'alt':
            return `7ch`;
        case 'sign':
            return `5ch`;
        case 'rmk':
            return `15ch`;
        default:
            return '10ch';
    }
}

function createTableHeader() {
    const $table = $('#navlog-table');
    const $headerRow = $('<tr>', {class: 'header-row'});
    $headerRow.append($('<th>', {class: 'no-print'})); // 空のセルを先頭に追加
    columns.forEach(col => {
        if(col.name === 'pointType') {
            $headerRow.append($('<th>', {class: 'no-print'}));
        } else {
            $headerRow.append($('<th>', {class: [col.name, col.type].join(' ')}).text(col.header));
        }
    });
    $headerRow.append($('<th>', {class: 'no-print'})); // ボタン用のセル
    $table.append($headerRow);
}

function createTotalRow() {
    const $table = $('#navlog-table');
    const $totalRow = $('<tr id="total-row">');
    const totalCols = columns.length;
    $totalRow.append($('<td>', {class: 'no-print'}));
    $totalRow.append($('<td>', {class: 'no-print'}));

    let count = 0;
    for (let i = 1; i < totalCols; i++) {
        switch (columns[i].name) {
            case 'distance':
                $totalRow.append($('<td>', {colspan: count,style: 'text-align: right'}).text('合計'));
                count = 0;
                $totalRow.append($('<td>', {id: 'total-distance'}).text('0 nm'));
                break;
    
            case 'ete':
                $totalRow.append($('<td>', {colspan: count}));
                count = 0;
                $totalRow.append($('<td>', {id: 'total-ete'}).text('0 \''));
                break;

            case 'fuel':
                $totalRow.append($('<td>', {colspan: count-2}));
                count = -1;
                $totalRow.append($('<td>', {style: "text-align:right"}).text('燃料'));
                $totalRow.append($('<td>').text('使用可能'));
                $totalRow.append($('<td>').text('消費量'));
                $totalRow.append($('<td>').text('残燃料'));
                break;

            default:
                count++;
                break;
        }
    }
    $totalRow.append($('<td>', {colspan: count}));
    $totalRow.append($('<td>', {class: 'no-print'}));

    $table.append($totalRow);
}

function addDepartureRow() {
    const $table = $('#navlog-table');
    const $row = $('<tr>', {class: 'departure-row'})
    .append($('<td>', {class: 'no-print'}))
    .append($('<td>', {class: 'no-print'}).text('出発地'))
    .append($('<td>', {class: 'name'}).append(
        $('<div>').append(
            $('<input>', {type: 'text', name: 'departure', style: `width: ${getInputSize('text')}`})
        )
    ))
    .append($('<td>', {colspan: columns.length-3}))
    .append($('<td>', {class: 'rmk'}).append(
        $('<input>', {type: 'text', name: 'rmk', style: `width: ${getInputSize('rmk')}`})
    ))
    $table.append($row);
}

function addRow(insertAfterIndex = null) {
    const $table = $('#navlog-table');
    const $rows = $table.find('tr');
    const $totalRow = $('#total-row');
    const $row = $('<tr>');

    const $addButtonCell = $('<td>', {class: 'no-print'}).append($('<button>', {
        type: 'button',
        text: '行を追加',
        click: () => addRow($row.index())
    }));
    $row.append($addButtonCell);

    columns.forEach(col => {
        const $cell = $('<td>', {class: [col.name, col.type].join(' ')});
        let $input;

        if (col.type == 'select') {
            $input = $('<select>', {name: col.name}).append(
                $('<option>', {value: 'CP', text: 'CP'}),
                $('<option>', {value: '変針点', text: '変針点', selected: true})
            );
            $input.on('change', function() {
                if ($(this).val() === '変針点') {
                    $row.addClass('leg-border');
                    $row.removeClass('checkpoint-border');
                } else {
                    $row.removeClass('leg-border');
                    $row.addClass('checkpoint-border');
                }
                updateTotals();
            });
            $cell.addClass('no-print');
        } else if (col.type == 'none') {
            $input = $('<span>');
        } else {
            $input = $('<input>', {
                type: ['text', 'sign', 'freq', 'rmk'].includes(col.type) ? 'text' : 'number',
                name: col.name,
                style: `width: ${getInputSize(col.type)}`
            });
        }

        if (this.value !== '' && $table.find('tr').length - 2 === $row.index()) {
            addRow();
        }

        if (['tas', 'windDir', 'windSpeed', 'tc', 'distance', 'dev'].includes(col.name)) {
            $input.on('input', function() {
                calculateNavlog($row[0]);
            });
        }

        if (col.name === 'name') {
            $input = $("<div>").append($input);
        }

        if (col.default) {
            $input.val(col.default);
        }

        $cell.append($input);

        if (col.name == 'vor') {
            $sign = $('<input>', {type: 'text', name: 'vorSign', style: `width: ${getInputSize('sign')}`});
            $sign.on('input', function() {
                updateMorseCode(this);
            });
            $cell.append($('<br>'), $sign, $('<div>', {class: 'morse-code'})); // モールス符号を表示するための要素
        }

        $cell.append(getUnit(col.type));

        $row.append($cell);
    });

    const $deleteButtonCell = $('<td>', {class: 'no-print'}).append($('<button>', {
        type: 'button',
        text: '削除',
        click: () => {
            $row.remove();
            updateTotals();
        }
    }));
    $row.append($deleteButtonCell);

    if (insertAfterIndex !== null) {
        $rows.eq(insertAfterIndex).after($row);
    } else {
        $totalRow.before($row);
    }
    updateTotals();
}
