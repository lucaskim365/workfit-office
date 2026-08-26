import { useState, useRef, useEffect } from 'react';
import type { FormField, FieldValue } from '@/domain/approvalForm/schema';
import { getCellMergeInfo, type CellMerge } from './utils';
import { EditableHeader } from './EditableHeader';
interface TableFieldEditorProps {
  field: FormField;
  v: FieldValue;
  set: (patch: Record<string, FieldValue>) => void;
}

export function TableFieldEditor({ field, v, set }: TableFieldEditorProps) {
  const [localColWidths, setLocalColWidths] = useState<Record<string, string>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let w: Record<string, string> = {};
    if (field.placeholder) {
      try {
        const cfg = JSON.parse(field.placeholder);
        if (cfg && cfg.colWidths) w = cfg.colWidths;
      } catch (e) {}
    }
    if (typeof v === 'string' && v) {
      try {
        const parsed = JSON.parse(v);
        if (parsed && parsed.colWidths) w = parsed.colWidths;
      } catch (e) {}
    }
    setLocalColWidths(w);
  }, [v, field.placeholder]);

  const defaultCols = field.options && field.options.length > 0 ? field.options : ['구분', '항목', '내용'];
  const defaultRows: Array<Record<string, string>> = [
    defaultCols.reduce((acc: Record<string, string>, col: string) => ({ ...acc, [col]: '' }), {}),
    defaultCols.reduce((acc: Record<string, string>, col: string) => ({ ...acc, [col]: '' }), {}),
    defaultCols.reduce((acc: Record<string, string>, col: string) => ({ ...acc, [col]: '' }), {}),
  ];

  const {
    cols,
    rows,
    tableWidth,
    colWidths,
    merges,
    headerValues,
    amountCells,
    sumCell,
    secretCols,
    secretCells,
    secretRows,
  } = (() => {
    try {
      if (v && typeof v === 'string') {
        const parsedData = JSON.parse(v);
        const cells: Array<{ rIdx: number; col: string }> = parsedData.amountCells
          ? parsedData.amountCells
          : parsedData.amountCell
          ? [parsedData.amountCell]
          : [];
        return {
          cols: Array.isArray(parsedData.cols) && parsedData.cols.length > 0 ? parsedData.cols : defaultCols,
          rows: Array.isArray(parsedData.rows) ? parsedData.rows : defaultRows,
          tableWidth: (parsedData.tableWidth || '100%') as string,
          colWidths: (parsedData.colWidths || {}) as Record<string, string>,
          merges: (parsedData.merges ?? []) as CellMerge[],
          headerValues: (parsedData.headerValues ?? {}) as Record<string, string>,
          amountCells: cells,
          sumCell: parsedData.sumCell as { rIdx: number; col: string } | null,
          secretCols: Array.isArray(parsedData.secretCols) ? (parsedData.secretCols as string[]) : [],
          secretCells: Array.isArray(parsedData.secretCells) ? (parsedData.secretCells as string[]) : [],
          secretRows: Array.isArray(parsedData.secretRows) ? (parsedData.secretRows as number[]) : [],
        };
      } else if (field.placeholder) {
        const parsedData = JSON.parse(field.placeholder);
        const cells = parsedData.amountCells
          ? (parsedData.amountCells as Array<{ rIdx: number; col: string }>)
          : parsedData.amountCell
          ? [parsedData.amountCell as { rIdx: number; col: string }]
          : [];
        return {
          cols: (parsedData.cols ?? parsedData.options ?? defaultCols) as string[],
          rows: (parsedData.defaultRows ?? defaultRows) as Array<Record<string, string>>,
          tableWidth: (parsedData.tableWidth ?? '100%') as string,
          colWidths: (parsedData.colWidths ?? {}) as Record<string, string>,
          merges: (parsedData.merges ?? []) as CellMerge[],
          headerValues: (parsedData.headerValues ?? {}) as Record<string, string>,
          amountCells: cells,
          sumCell: parsedData.sumCell as { rIdx: number; col: string } | null,
          secretCols: Array.isArray(parsedData.secretCols) ? (parsedData.secretCols as string[]) : [],
          secretCells: Array.isArray(parsedData.secretCells) ? (parsedData.secretCells as string[]) : [],
          secretRows: Array.isArray(parsedData.secretRows) ? (parsedData.secretRows as number[]) : [],
        };
      }
    } catch (e) {}
    return {
      cols: defaultCols,
      rows: defaultRows,
      tableWidth: '100%',
      colWidths: {} as Record<string, string>,
      merges: [] as CellMerge[],
      headerValues: {} as Record<string, string>,
      amountCells: [] as Array<{ rIdx: number; col: string }>,
      sumCell: null,
      secretCols: [] as string[],
      secretCells: [] as string[],
      secretRows: [] as number[],
    };
  })();

  const getMergeInfo = (rIdx: number, cIdx: number) => getCellMergeInfo(rIdx, cIdx, merges);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rIdx: number; cIdx: number } | null>(null);
  const [dragRow, setDragRow] = useState<number | null>(null);
  const [dragCol, setDragCol] = useState<number | null>(null);
  const [dragOverRow, setDragOverRow] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);

  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  useEffect(() => {
    if (!v && rows.length > 0) {
      set({
        [field.key]: JSON.stringify({
          cols,
          rows,
          tableWidth,
          colWidths,
          merges,
          headerValues,
          amountCells,
          sumCell,
          secretCols,
          secretCells,
          secretRows,
        }),
      });
    }
  }, [v, field.key]);

  const save = (
    nextCols: string[],
    nextRows: Array<Record<string, string>>,
    nextMerges: CellMerge[],
    nextColWidths = colWidths,
    nextHeaderValues = headerValues,
    nextAmountCells = amountCells,
    nextSumCell = sumCell,
    nextSecretCols = secretCols,
    nextSecretCells = secretCells,
    nextSecretRows = secretRows
  ) =>
    set({
      [field.key]: JSON.stringify({
        cols: nextCols,
        rows: nextRows,
        tableWidth,
        colWidths: nextColWidths,
        merges: nextMerges,
        headerValues: nextHeaderValues,
        amountCells: nextAmountCells,
        sumCell: nextSumCell,
        secretCols: nextSecretCols,
        secretCells: nextSecretCells,
        secretRows: nextSecretRows,
      }),
    });

  const toggleSecretColumn = (col: string) => {
    const exists = secretCols.includes(col);
    const nextSecretCols = exists ? secretCols.filter((c) => c !== col) : [...secretCols, col];
    save(cols, rows, merges, colWidths, headerValues, amountCells, sumCell, nextSecretCols, secretCells, secretRows);
  };

  const toggleSecretCell = (rIdx: number, cIdx: number) => {
    const cellKey = `${rIdx}:${cIdx}`;
    const exists = secretCells.includes(cellKey);
    const nextSecretCells = exists ? secretCells.filter((c) => c !== cellKey) : [...secretCells, cellKey];
    save(cols, rows, merges, colWidths, headerValues, amountCells, sumCell, secretCols, nextSecretCells, secretRows);
  };

  const recalculateSum = (
    targetRows: Array<Record<string, string>>,
    targetAmountCells = amountCells,
    targetSumCell = sumCell
  ) => {
    if (!targetSumCell) return targetRows;
    const nextRows = [...targetRows];
    let sum = 0;
    nextRows.forEach((row, rowIdx: number) => {
      cols.forEach((cName: string) => {
        if (targetSumCell.rIdx === rowIdx && targetSumCell.col === cName) return;
        const isAutoAmt = cName.includes('금액');
        const isManualAmt = targetAmountCells.some((ac) => ac.rIdx === rowIdx && ac.col === cName);
        if (isAutoAmt || isManualAmt) {
          const num = Number(String(row[cName] ?? '').replace(/[^0-9]/g, '')) || 0;
          sum += num;
        }
      });
    });
    if (nextRows[targetSumCell.rIdx]) {
      nextRows[targetSumCell.rIdx] = {
        ...nextRows[targetSumCell.rIdx],
        [targetSumCell.col]: sum > 0 ? String(sum) : '',
      };
    }
    return nextRows;
  };

  const toggleAmountCell = (rIdx: number, col: string) => {
    const exists = amountCells.some((c) => c.rIdx === rIdx && c.col === col);
    const nextCells = exists
      ? amountCells.filter((c) => !(c.rIdx === rIdx && c.col === col))
      : [...amountCells, { rIdx, col }];
    const nextRows = recalculateSum(rows, nextCells, sumCell);
    save(cols, nextRows, merges, colWidths, headerValues, nextCells, sumCell);
  };

  const toggleAmountColumn = (col: string) => {
    const allDesignated = rows.every((_r: Record<string, string>, rowIdx: number) =>
      amountCells.some((c) => c.rIdx === rowIdx && c.col === col)
    );
    let nextCells = amountCells;
    if (allDesignated) {
      nextCells = amountCells.filter((c) => c.col !== col);
    } else {
      const existing = new Set(amountCells.filter((c) => c.col === col).map((c) => c.rIdx));
      const toAdd = rows
        .map((_r: Record<string, string>, rIdx: number) => rIdx)
        .filter((rIdx: number) => !existing.has(rIdx))
        .map((rIdx: number) => ({ rIdx, col }));
      nextCells = [...amountCells, ...toAdd];
    }
    const nextRows = recalculateSum(rows, nextCells, sumCell);
    save(cols, nextRows, merges, colWidths, headerValues, nextCells, sumCell);
  };

  const toggleSumCell = (rIdx: number, col: string) => {
    const isCurrentlySum = sumCell && sumCell.rIdx === rIdx && sumCell.col === col;
    const nextSumCell = isCurrentlySum ? null : { rIdx, col };
    const nextAmountCells = isCurrentlySum
      ? amountCells
      : amountCells.filter((c) => !(c.rIdx === rIdx && c.col === col));
    const nextRows = recalculateSum(rows, nextAmountCells, nextSumCell);
    save(cols, nextRows, merges, colWidths, headerValues, nextAmountCells, nextSumCell);
  };

  const updateCell = (rIdx: number, col: string, val: string) => {
    const nextRows = [...rows];
    nextRows[rIdx] = { ...nextRows[rIdx], [col]: val };
    const nextRowsWithSum = recalculateSum(nextRows, amountCells, sumCell);
    save(cols, nextRowsWithSum, merges);
  };

  const updateHeaderCell = (col: string, val: string) => {
    const nextHeaderValues = { ...headerValues, [col]: val };
    save(cols, rows, merges, colWidths, nextHeaderValues);
  };

  const addRow = () => {
    const newRow = cols.reduce((acc: Record<string, string>, col: string) => ({ ...acc, [col]: '' }), {});
    save(cols, [...rows, newRow], merges);
  };

  const removeRow = (rowIndex: number) => {
    const nextRows = rows.filter((_r: Record<string, string>, idx: number) => idx !== rowIndex);
    const nextMerges = merges
      .map((m: CellMerge) => {
        if (m.startRow > rowIndex) {
          return { ...m, startRow: m.startRow - 1 };
        }
        const endRow = m.startRow + m.rowSpan - 1;
        if (m.startRow <= rowIndex && endRow >= rowIndex) {
          return { ...m, rowSpan: m.rowSpan - 1 };
        }
        return m;
      })
      .filter((m: CellMerge) => m.rowSpan > 0);

    const nextAmountCells = amountCells
      .filter((c) => c.rIdx !== rowIndex)
      .map((c) => {
        if (c.rIdx > rowIndex) return { ...c, rIdx: c.rIdx - 1 };
        return c;
      });

    let nextSumCell = sumCell;
    if (sumCell) {
      if (sumCell.rIdx === rowIndex) {
        nextSumCell = null;
      } else if (sumCell.rIdx > rowIndex) {
        nextSumCell = { ...sumCell, rIdx: sumCell.rIdx - 1 };
      }
    }

    const nextSecretCells = secretCells
      .filter((cellKey) => {
        const [rStr] = cellKey.split(':');
        return Number(rStr) !== rowIndex;
      })
      .map((cellKey) => {
        const [rStr, cStr] = cellKey.split(':');
        const r = Number(rStr);
        if (r > rowIndex) return `${r - 1}:${cStr}`;
        return cellKey;
      });

    const nextSecretRows = secretRows
      .filter((r) => r !== rowIndex)
      .map((r) => (r > rowIndex ? r - 1 : r));

    const nextRowsWithSum = recalculateSum(nextRows, nextAmountCells, nextSumCell);
    save(
      cols,
      nextRowsWithSum,
      nextMerges,
      colWidths,
      headerValues,
      nextAmountCells,
      nextSumCell,
      secretCols,
      nextSecretCells,
      nextSecretRows
    );
  };

  const addCol = (cIdx: number) => {
    let suffix = cols.length + 1;
    let newColName = `열${suffix}`;
    while (cols.includes(newColName)) {
      suffix++;
      newColName = `열${suffix}`;
    }
    const nextCols = [...cols];
    nextCols.splice(cIdx + 1, 0, newColName);
    const nextRows = rows.map((row: Record<string, string>) => ({ ...row, [newColName]: '' }));
    const nextMerges = merges.map((m: CellMerge) => {
      if (m.startCol > cIdx) return { ...m, startCol: m.startCol + 1 };
      if (m.startCol + m.colSpan - 1 >= cIdx + 1) return { ...m, colSpan: m.colSpan + 1 };
      return m;
    });
    save(nextCols, nextRows, nextMerges);
  };

  const removeCol = (cIdx: number) => {
    if (cols.length <= 1) return;
    const colName = cols[cIdx];
    const nextCols = cols.filter((_c: string, idx: number) => idx !== cIdx);
    const nextRows = rows.map((row: Record<string, string>) => {
      const r = { ...row };
      delete r[colName];
      return r;
    });
    const nextWidths = { ...colWidths };
    delete nextWidths[colName];
    const nextHeaderValues = { ...headerValues };
    delete nextHeaderValues[colName];
    const nextMerges = merges
      .map((m: CellMerge) => {
        if (m.startCol > cIdx) return { ...m, startCol: m.startCol - 1 };
        if (m.startCol + m.colSpan - 1 >= cIdx) return { ...m, colSpan: m.colSpan - 1 };
        return m;
      })
      .filter((m: CellMerge) => m.colSpan > 0);
    save(nextCols, nextRows, nextMerges, nextWidths, nextHeaderValues);
  };

  const copyRowBelow = (rowIndex: number) => {
    const newRow = { ...rows[rowIndex] };
    const nextRows = [...rows];
    nextRows.splice(rowIndex + 1, 0, newRow);

    const nextMerges: CellMerge[] = [];
    merges.forEach((m: CellMerge) => {
      if (m.startRow < 0) {
        nextMerges.push(m);
      } else if (m.startRow > rowIndex) {
        nextMerges.push({ ...m, startRow: m.startRow + 1 });
      } else if (m.startRow === rowIndex) {
        nextMerges.push(m);
        nextMerges.push({ ...m, startRow: rowIndex + 1 });
      } else {
        const endRow = m.startRow + m.rowSpan - 1;
        if (endRow > rowIndex) {
          nextMerges.push({ ...m, rowSpan: m.rowSpan + 1 });
        } else {
          nextMerges.push(m);
        }
      }
    });

    const nextAmountCells = amountCells.map((c) => {
      if (c.rIdx > rowIndex) return { ...c, rIdx: c.rIdx + 1 };
      return c;
    });
    amountCells.forEach((c) => {
      if (c.rIdx === rowIndex) {
        nextAmountCells.push({ rIdx: rowIndex + 1, col: c.col });
      }
    });

    let nextSumCell = sumCell;
    if (sumCell) {
      if (sumCell.rIdx > rowIndex) {
        nextSumCell = { ...sumCell, rIdx: sumCell.rIdx + 1 };
      }
    }

    const nextSecretCells: string[] = [];
    secretCells.forEach((cellKey) => {
      const [rStr, cStr] = cellKey.split(':');
      const r = Number(rStr);
      const c = Number(cStr);
      if (r > rowIndex) {
        nextSecretCells.push(`${r + 1}:${c}`);
      } else {
        nextSecretCells.push(cellKey);
        if (r === rowIndex) {
          nextSecretCells.push(`${rowIndex + 1}:${c}`);
        }
      }
    });

    const nextSecretRows = secretRows.map((r) => (r > rowIndex ? r + 1 : r));
    if (secretRows.includes(rowIndex)) {
      nextSecretRows.push(rowIndex + 1);
    }

    const nextRowsWithSum = recalculateSum(nextRows, nextAmountCells, nextSumCell);
    save(
      cols,
      nextRowsWithSum,
      nextMerges,
      colWidths,
      headerValues,
      nextAmountCells,
      nextSumCell,
      secretCols,
      nextSecretCells,
      nextSecretRows
    );
  };

  const copyColRight = (cIdx: number) => {
    const srcCol = cols[cIdx];
    let suffix = 1;
    let newColName = `${srcCol}_사본`;
    while (cols.includes(newColName)) {
      suffix++;
      newColName = `${srcCol}_사본${suffix}`;
    }

    const nextCols = [...cols];
    nextCols.splice(cIdx + 1, 0, newColName);

    const nextRows = rows.map((row: Record<string, string>) => ({
      ...row,
      [newColName]: row[srcCol] ?? '',
    }));

    const srcHeaderVal = headerValues[srcCol] !== undefined ? headerValues[srcCol] : srcCol;
    const nextHeaderValues = {
      ...headerValues,
      [newColName]: `${srcHeaderVal} 사본`,
    };

    const srcWidth = colWidths[srcCol] || '120px';
    const nextColWidths = {
      ...colWidths,
      [newColName]: srcWidth,
    };

    const nextMerges = merges.map((m: CellMerge) => {
      if (m.startCol > cIdx) return { ...m, startCol: m.startCol + 1 };
      if (m.startCol <= cIdx && m.startCol + m.colSpan - 1 >= cIdx) {
        return { ...m, colSpan: m.colSpan + 1 };
      }
      return m;
    });

    const nextSecretCols = secretCols.includes(srcCol) ? [...secretCols, newColName] : secretCols;

    const nextSecretCells: string[] = [];
    secretCells.forEach((cellKey) => {
      const [rStr, cStr] = cellKey.split(':');
      const r = Number(rStr);
      const c = Number(cStr);
      if (c > cIdx) {
        nextSecretCells.push(`${r}:${c + 1}`);
      } else {
        nextSecretCells.push(cellKey);
        if (c === cIdx) {
          nextSecretCells.push(`${r}:${c + 1}`);
        }
      }
    });

    const nextAmountCells = [...amountCells];
    amountCells.forEach((ac) => {
      if (ac.col === srcCol) {
        nextAmountCells.push({ rIdx: ac.rIdx, col: newColName });
      }
    });

    const nextRowsWithSum = recalculateSum(nextRows, nextAmountCells, sumCell);
    save(
      nextCols,
      nextRowsWithSum,
      nextMerges,
      nextColWidths,
      nextHeaderValues,
      nextAmountCells,
      sumCell,
      nextSecretCols,
      nextSecretCells
    );
  };

  const handleResizeStart = (e: React.MouseEvent, colName: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const parentTh = e.currentTarget.parentElement;
    const startWidth = parentTh ? parentTh.getBoundingClientRect().width : 120;
    let currentWidth = startWidth;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      currentWidth = Math.max(40, startWidth + dx);
      setLocalColWidths((prev) => ({ ...prev, [colName]: `${currentWidth}px` }));
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      save(cols, rows, merges, { ...colWidths, [colName]: `${currentWidth}px` });
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const mergeRight = (rIdx: number, cIdx: number) => {
    if (cIdx >= cols.length - 1) return;
    const { isMerged, mergeInfo } = getMergeInfo(rIdx, cIdx);
    let nextMerges = [...merges];
    if (isMerged && mergeInfo && mergeInfo.startRow === rIdx && mergeInfo.startCol === cIdx) {
      nextMerges = merges.map((m: CellMerge) =>
        m.startRow === rIdx && m.startCol === cIdx ? { ...m, colSpan: m.colSpan + 1 } : m
      );
    } else if (!isMerged) {
      nextMerges.push({ startRow: rIdx, startCol: cIdx, rowSpan: 1, colSpan: 2 });
    }
    save(cols, rows, nextMerges);
  };

  const mergeDown = (rIdx: number, cIdx: number) => {
    if (rIdx !== -1 && rIdx >= rows.length - 1) return;
    const { isMerged, mergeInfo } = getMergeInfo(rIdx, cIdx);
    let nextMerges = [...merges];
    if (isMerged && mergeInfo && mergeInfo.startRow === rIdx && mergeInfo.startCol === cIdx) {
      nextMerges = merges.map((m: CellMerge) =>
        m.startRow === rIdx && m.startCol === cIdx ? { ...m, rowSpan: m.rowSpan + 1 } : m
      );
    } else if (!isMerged) {
      nextMerges.push({ startRow: rIdx, startCol: cIdx, rowSpan: 2, colSpan: 1 });
    }
    save(cols, rows, nextMerges);
  };

  const unmerge = (rIdx: number, cIdx: number) => {
    const { mergeInfo } = getMergeInfo(rIdx, cIdx);
    if (!mergeInfo) return;
    const nextMerges = merges.filter(
      (m: CellMerge) => !(m.startRow === mergeInfo.startRow && m.startCol === mergeInfo.startCol)
    );
    save(cols, rows, nextMerges);
  };

  const handleCellContextMenu = (e: React.MouseEvent, rIdx: number, cIdx: number) => {
    e.preventDefault();
    const zoom =
      parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--font-scale') || '1.1875') || 1;
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setContextMenu({
        x: (e.clientX - rect.left) / zoom,
        y: (e.clientY - rect.top) / zoom,
        rIdx,
        cIdx,
      });
    } else {
      setContextMenu({ x: e.clientX / zoom, y: e.clientY / zoom, rIdx, cIdx });
    }
  };

  const handleRowDragStart = (e: React.DragEvent, rIdx: number) => {
    setDragRow(rIdx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleRowDragOver = (e: React.DragEvent, rIdx: number) => {
    e.preventDefault();
    setDragOverRow(rIdx);
  };
  const handleRowDrop = (rIdx: number) => {
    if (dragRow === null || dragRow === rIdx) {
      setDragRow(null);
      setDragOverRow(null);
      return;
    }

    if (dragRow === -1 || rIdx === -1) {
      const dataIdx = dragRow === -1 ? rIdx : dragRow;
      const oldHeaderAsRow = cols.reduce(
        (acc: Record<string, string>, col: string) => ({
          ...acc,
          [col]: headerValues[col] !== undefined ? headerValues[col] : col,
        }),
        {}
      );
      const nextHeaderValues = cols.reduce(
        (acc: Record<string, string>, col: string) => ({
          ...acc,
          [col]: rows[dataIdx][col] ?? '',
        }),
        {}
      );
      const nextRows = [...rows];
      nextRows[dataIdx] = oldHeaderAsRow;
      const nextMerges = merges.map((m: CellMerge) => {
        if (m.startRow === -1) return { ...m, startRow: dataIdx };
        if (m.startRow === dataIdx) return { ...m, startRow: -1 };
        return m;
      });
      save(cols, nextRows, nextMerges, colWidths, nextHeaderValues);
      setDragRow(null);
      setDragOverRow(null);
      return;
    }

    const nextRows = [...rows];
    const [moved] = nextRows.splice(dragRow, 1);
    nextRows.splice(rIdx, 0, moved);
    const nextMerges = merges.map((m: CellMerge) => {
      if (m.startRow < 0) return m;
      let nr = m.startRow;
      if (m.startRow === dragRow) nr = rIdx;
      else if (dragRow < rIdx && m.startRow > dragRow && m.startRow <= rIdx) nr = m.startRow - 1;
      else if (dragRow > rIdx && m.startRow >= rIdx && m.startRow < dragRow) nr = m.startRow + 1;
      return { ...m, startRow: nr };
    });
    save(cols, nextRows, nextMerges);
    setDragRow(null);
    setDragOverRow(null);
  };

  const handleColDragStart = (e: React.DragEvent, cIdx: number) => {
    setDragCol(cIdx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleColDragOver = (e: React.DragEvent, cIdx: number) => {
    e.preventDefault();
    setDragOverCol(cIdx);
  };
  const handleColDrop = (cIdx: number) => {
    if (dragCol === null || dragCol === cIdx) {
      setDragCol(null);
      setDragOverCol(null);
      return;
    }
    const nextCols = [...cols];
    const [movedCol] = nextCols.splice(dragCol, 1);
    nextCols.splice(cIdx, 0, movedCol);
    const nextRows = rows.map((row: Record<string, string>) => {
      const newRow: Record<string, string> = {};
      nextCols.forEach((c) => {
        newRow[c] = row[c] ?? '';
      });
      return newRow;
    });
    const nextHeaderValues: Record<string, string> = {};
    nextCols.forEach((c) => {
      if (c in headerValues) nextHeaderValues[c] = headerValues[c];
    });
    const nextMerges = merges.map((m: CellMerge) => {
      let nc = m.startCol;
      if (m.startCol === dragCol) nc = cIdx;
      else if (dragCol < cIdx && m.startCol > dragCol && m.startCol <= cIdx) nc = m.startCol - 1;
      else if (dragCol > cIdx && m.startCol >= cIdx && m.startCol < dragCol) nc = m.startCol + 1;
      return { ...m, startCol: nc };
    });
    save(nextCols, nextRows, nextMerges, colWidths, nextHeaderValues);
    setDragCol(null);
    setDragOverCol(null);
  };

  return (
    <div ref={containerRef} className="mt-1 rounded-lg border border-border bg-panel p-2 relative">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <span className="text-[11px] font-semibold text-ink2">
          표 편집기 — 우클릭: 셀 병합 · 헤더/핸들 드래그: 열·행 순서 변경
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="table-fixed border-collapse text-left text-[11.5px] border border-border w-full">
          <colgroup>
            <col style={{ width: '20px' }} />
            {cols.map((col: string, cIdx: number) => (
              <col key={cIdx} style={{ width: localColWidths[col] || 'auto' }} />
            ))}
            <col style={{ width: '45px' }} />
          </colgroup>
          <tbody>
            <tr
              className={`border-b border-border transition-colors ${
                dragOverRow === -1 && dragRow !== -1 ? 'border-t-2 border-t-teal' : ''
              } ${dragRow === -1 ? 'opacity-40' : ''}`}
              onDragOver={(e) => handleRowDragOver(e, -1)}
              onDrop={() => handleRowDrop(-1)}
            >
              <td className="p-0 text-center border-r border-border w-[20px]">
                <span
                  draggable
                  onDragStart={(e) => handleRowDragStart(e, -1)}
                  onDragEnd={() => {
                    setDragRow(null);
                    setDragOverRow(null);
                  }}
                  className="text-ink3 cursor-grab active:cursor-grabbing select-none text-[13px] block leading-none px-1 py-2"
                  title="드래그하여 행 순서 변경"
                >
                  ⠿
                </span>
              </td>
              {cols.map((col: string, cIdx: number) => {
                const { isMerged, isStart, rowSpan, colSpan } = getMergeInfo(-1, cIdx);
                if (isMerged && !isStart) return null;
                const isDragTarget = dragOverCol === cIdx && dragCol !== cIdx;
                return (
                  <th
                    key={cIdx}
                    rowSpan={rowSpan > 1 ? rowSpan : undefined}
                    colSpan={colSpan > 1 ? colSpan : undefined}
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation();
                      handleColDragStart(e, cIdx);
                    }}
                    onDragOver={(e) => {
                      e.stopPropagation();
                      handleColDragOver(e, cIdx);
                    }}
                    onDrop={(e) => {
                      e.stopPropagation();
                      handleColDrop(cIdx);
                    }}
                    onDragEnd={() => {
                      setDragCol(null);
                      setDragOverCol(null);
                    }}
                    onContextMenu={(e) => handleCellContextMenu(e, -1, cIdx)}
                    className={`p-1.5 relative group border-r border-border min-w-[50px] cursor-grab active:cursor-grabbing transition-colors ${
                      isDragTarget ? 'bg-teal-soft/40 border-l-2 border-l-teal' : ''
                    } ${dragCol === cIdx ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center gap-1 pr-2">
                      <EditableHeader
                        value={headerValues[col] !== undefined ? headerValues[col] : col}
                        onChange={(val) => updateHeaderCell(col, val)}
                      />
                      {cols.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCol(cIdx);
                          }}
                          className="text-[10px] text-ink3 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold shrink-0"
                          title="이 열 삭제"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleResizeStart(e, col);
                      }}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal bg-[#ddd]/30 group-hover:bg-[#ddd] active:bg-teal transition-colors"
                      style={{ zIndex: 10 }}
                      title="드래그하여 열 너비 조절"
                    />
                  </th>
                );
              })}
              <th className="w-[32px] p-1 border-r border-border text-center relative">
                <button
                  type="button"
                  onClick={() => addCol(cols.length - 1)}
                  className="w-6 h-6 rounded-full border border-border bg-panel text-[13px] font-bold text-ink2 hover:border-teal hover:text-teal hover:bg-teal-soft flex items-center justify-center mx-auto transition-colors"
                  title="오른쪽에 열 추가"
                >
                  +
                </button>
              </th>
            </tr>
            {rows.map((row: Record<string, string>, rIdx: number) => {
              const isDragRowTarget = dragOverRow === rIdx && dragRow !== rIdx;
              return (
                <tr
                  key={rIdx}
                  onDragOver={(e) => handleRowDragOver(e, rIdx)}
                  onDrop={() => handleRowDrop(rIdx)}
                  className={`border-b border-border/50 hover:bg-panel-alt/30 transition-colors ${
                    isDragRowTarget ? 'border-t-2 border-t-teal' : ''
                  } ${dragRow === rIdx ? 'opacity-40' : ''}`}
                >
                  <td className="p-0 text-center border-r border-border w-[20px]">
                    <span
                      draggable
                      onDragStart={(e) => handleRowDragStart(e, rIdx)}
                      onDragEnd={() => {
                        setDragRow(null);
                        setDragOverRow(null);
                      }}
                      className="text-ink3 cursor-grab active:cursor-grabbing select-none text-[13px] block leading-none px-1 py-2"
                      title="드래그하여 행 순서 변경"
                    >
                      ⠿
                    </span>
                  </td>
                  {cols.map((col: string, cIdx: number) => {
                    const isNumLike =
                      col.includes('수량') ||
                      col.includes('단가') ||
                      col.includes('가격') ||
                      col.includes('금액') ||
                      col.includes('수') ||
                      col.includes('율');
                    const { isMerged, isStart, rowSpan, colSpan } = getMergeInfo(rIdx, cIdx);
                    if (isMerged && !isStart) return null;
                    const isAutoAmt = col.includes('금액');
                    const isManualAmt = amountCells.some((c) => c.rIdx === rIdx && c.col === col);
                    const isAmountCell = isAutoAmt || isManualAmt;
                    const isSumCell = !!(sumCell && sumCell.rIdx === rIdx && sumCell.col === col);
                    const isSecretCell = secretCols.includes(col) || secretCells.includes(`${rIdx}:${cIdx}`);

                    return (
                      <td
                        key={col}
                        rowSpan={rowSpan}
                        colSpan={colSpan}
                        onContextMenu={(e) => handleCellContextMenu(e, rIdx, cIdx)}
                        className={`p-1 border-r border-border transition-colors ${
                          isSecretCell ? 'bg-amber-500/10 dark:bg-amber-500/20' : ''
                        }`}
                        title={isSecretCell ? '보안/마스킹 지정된 셀입니다 (우클릭으로 변경)' : ''}
                      >
                        <input
                          value={row[col] ?? ''}
                          onChange={(e) => {
                            const val = isAmountCell ? e.target.value.replace(/[^0-9]/g, '') : e.target.value;
                            updateCell(rIdx, col, val);
                          }}
                          disabled={isSumCell}
                          placeholder={isNumLike || isAmountCell || isSumCell ? '0' : ''}
                          className={`w-full rounded border border-border px-1.5 py-1 text-[11px] text-ink outline-none focus:border-teal ${
                            isSumCell
                              ? 'bg-panel/40 font-semibold cursor-not-allowed text-teal'
                              : isSecretCell
                              ? 'bg-amber-500/5 font-semibold text-amber-700 dark:text-amber-300'
                              : 'bg-panel-alt'
                          }`}
                        />
                      </td>
                    );
                  })}
                  <td className="p-1 text-center border-none bg-transparent">
                    <button
                      type="button"
                      onClick={() => removeRow(rIdx)}
                      className="text-[12px] text-ink3 hover:text-red-500 font-bold"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols.length + 2} className="py-4 text-center text-ink3 text-[11px]">
                  표가 비어 있습니다. 아래 버튼을 눌러 행/열을 추가하세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="mt-2 w-full rounded border border-dashed border-border-hi py-1 text-[11px] font-semibold text-ink2 hover:border-teal hover:text-teal"
      >
        + 행 추가
      </button>

      {contextMenu && (
        <div
          className="absolute z-50 min-w-[130px] rounded-lg border border-border bg-panel py-1.5 shadow-xl text-[12px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.rIdx === -1 && (
            <>
              {secretCols.includes(cols[contextMenu.cIdx]) ? (
                <button
                  type="button"
                  onClick={() => {
                    toggleSecretColumn(cols[contextMenu.cIdx]);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-amber-600 font-semibold"
                >
                  보안 열 지정 해제
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    toggleSecretColumn(cols[contextMenu.cIdx]);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-teal font-semibold"
                >
                  보안 열로 지정
                </button>
              )}
              {rows.every((_r: Record<string, string>, rowIdx: number) =>
                amountCells.some((c) => c.rIdx === rowIdx && c.col === cols[contextMenu.cIdx])
              ) ? (
                <button
                  type="button"
                  onClick={() => {
                    toggleAmountColumn(cols[contextMenu.cIdx]);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-amber-600 font-semibold"
                >
                  💰 금액 열 지정 해제
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    toggleAmountColumn(cols[contextMenu.cIdx]);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-teal font-semibold"
                >
                  💰 금액 열로 지정
                </button>
              )}
              <hr className="border-border my-1" />
            </>
          )}
          {contextMenu.rIdx !== -1 && (
            <>
              {secretCells.includes(`${contextMenu.rIdx}:${contextMenu.cIdx}`) ? (
                <button
                  type="button"
                  onClick={() => {
                    toggleSecretCell(contextMenu.rIdx, contextMenu.cIdx);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-amber-600 font-semibold"
                >
                  보안 셀 지정 해제
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    toggleSecretCell(contextMenu.rIdx, contextMenu.cIdx);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-teal font-semibold"
                >
                  보안 셀로 지정
                </button>
              )}

              {amountCells.some((c) => c.rIdx === contextMenu.rIdx && c.col === cols[contextMenu.cIdx]) ? (
                <button
                  type="button"
                  onClick={() => {
                    toggleAmountCell(contextMenu.rIdx, cols[contextMenu.cIdx]);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-amber-600 font-semibold"
                >
                  💰 금액 셀 지정 해제
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    toggleAmountCell(contextMenu.rIdx, cols[contextMenu.cIdx]);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-teal font-semibold"
                >
                  💰 금액 셀로 지정
                </button>
              )}

              {sumCell && sumCell.rIdx === contextMenu.rIdx && sumCell.col === cols[contextMenu.cIdx] ? (
                <button
                  type="button"
                  onClick={() => {
                    toggleSumCell(contextMenu.rIdx, cols[contextMenu.cIdx]);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-amber-600 font-semibold"
                >
                  📊 합산 셀 지정 해제
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    toggleSumCell(contextMenu.rIdx, cols[contextMenu.cIdx]);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-indigo-600 font-semibold"
                >
                  📊 합산 결과 표시 지정
                </button>
              )}
              <hr className="border-border my-1" />
            </>
          )}
          {contextMenu.rIdx !== -1 && (
            <button
              type="button"
              onClick={() => {
                copyRowBelow(contextMenu.rIdx);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-teal font-semibold"
            >
              📋 행: 아래에 현재 행 복사
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              copyColRight(contextMenu.cIdx);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-indigo-600 font-semibold"
          >
            📋 열: 오른쪽에 현재 열 복사
          </button>
          <hr className="border-border my-1" />
          <button
            type="button"
            onClick={() => {
              mergeRight(contextMenu.rIdx, contextMenu.cIdx);
              setContextMenu(null);
            }}
            disabled={contextMenu.cIdx >= cols.length - 1}
            className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-ink disabled:opacity-50 disabled:hover:bg-transparent"
          >
            👉 오른쪽 셀과 병합
          </button>
          <button
            type="button"
            onClick={() => {
              mergeDown(contextMenu.rIdx, contextMenu.cIdx);
              setContextMenu(null);
            }}
            disabled={contextMenu.rIdx !== -1 && contextMenu.rIdx >= rows.length - 1}
            className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-ink disabled:opacity-50 disabled:hover:bg-transparent"
          >
            👇 아래 셀과 병합
          </button>
          {getMergeInfo(contextMenu.rIdx, contextMenu.cIdx).isMerged && (
            <button
              type="button"
              onClick={() => {
                unmerge(contextMenu.rIdx, contextMenu.cIdx);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-ink"
            >
              🔓 병합 해제
            </button>
          )}
        </div>
      )}
    </div>
  );
}
