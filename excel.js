'use strict';

function exportExcel() {
  if (typeof XLSX === 'undefined') {
    alert('SheetJS の読み込みに失敗しています。ページを再読み込みしてください。');
    return;
  }

  const s = state;
  const { subtotal, tax, total } = calcTotals();
  const wb = XLSX.utils.book_new();

  // ━━ Sheet 1: 請求書（レイアウト） ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const sheet1 = [
    ['請  求  書'],
    [],
    ['請求書番号', s.invoiceNumber,  '',  '発行者', s.issuerName],
    ['発行日',     formatDate(s.issueDate),  '',  '',   s.issuerAddress],
    ['支払期限',   formatDate(s.dueDate),    '',  '',   s.issuerPhone ? `TEL: ${s.issuerPhone}` : ''],
    ['',           '',                       '',  '',   s.issuerEmail],
    [],
    ['請求先', s.recipientName + ' 御中'],
    s.recipientAddress ? ['', s.recipientAddress] : [],
    [],
    ['ご請求金額（税込）', total],
    [],
    ['─ 明 細 ─'],
    ['品目', '数量', '単位', '単価（円）', '金額（円）'],
    ...s.items.map(item => [
      item.name,
      parseFloat(item.qty) || 0,
      item.unit,
      parseFloat(item.price) || 0,
      itemAmount(item),
    ]),
    [],
    ['', '', '', '小計（円）',              subtotal],
    ['', '', '', `消費税（${s.taxRate}%）（円）`, tax],
    ['', '', '', '合計（円）',              total],
    [],
    s.bankInfo ? ['振込先', s.bankInfo] : [],
    [],
    s.notes ? ['備考', s.notes] : [],
  ].filter(row => row.length > 0);

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1);
  ws1['!cols'] = [
    { wch: 22 }, { wch: 20 }, { wch: 6 }, { wch: 22 }, { wch: 18 },
  ];

  // ご請求金額セルを数値として明示
  const amountRow = sheet1.findIndex(r => r[0] === 'ご請求金額（税込）');
  if (amountRow >= 0) {
    const cellAddr = XLSX.utils.encode_cell({ r: amountRow, c: 1 });
    if (ws1[cellAddr]) ws1[cellAddr].t = 'n';
  }

  XLSX.utils.book_append_sheet(wb, ws1, '請求書');

  // ━━ Sheet 2: 明細データ（テーブル形式） ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const sheet2 = [
    ['請求書番号', '発行日', '請求先', '品目', '数量', '単位', '単価（円）', '金額（円）'],
    ...s.items.map(item => [
      s.invoiceNumber,
      s.issueDate,
      s.recipientName,
      item.name,
      parseFloat(item.qty) || 0,
      item.unit,
      parseFloat(item.price) || 0,
      itemAmount(item),
    ]),
    [],
    ['', '', '', '', '', '', '小計',              subtotal],
    ['', '', '', '', '', '', `消費税（${s.taxRate}%）`, tax],
    ['', '', '', '', '', '', '合計',              total],
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2);
  ws2['!cols'] = [
    { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 24 },
    { wch: 7 },  { wch: 7 },  { wch: 16 }, { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws2, '明細データ');

  // ━━ ダウンロード ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const filename = `請求書_${s.invoiceNumber}_${s.issueDate}.xlsx`;
  XLSX.writeFile(wb, filename);
}
