// --- BOARD UI (DIJAMIN KOKOH, ANTI-BERANTAKAN, DAN KOTAK SEMPURNA) ---
function BoardUI({ gridSize, generatedData, revealedWords = [], onCellClick, interactive = false, activeWord = null, activeCell = null, userAnswers = {} }) {
  let grid = generatedData?.grid;
  if (!grid && generatedData?.gridString) {
    try { grid = JSON.parse(generatedData.gridString); } catch(e) { grid = []; }
  }
  const placedWords = generatedData?.placedWords || [];

  if (!grid || grid.length === 0) return <div className="text-center p-10 font-black text-slate-400">Papan gagal dibuat. Pastikan kata-katanya bisa bersilangan!</div>;

  return (
    <div className="w-full h-full flex items-center justify-center p-1 md:p-3 overflow-hidden">
      <div className="bg-[#4C1D95] border-4 border-[#2E1065] p-2 md:p-4 rounded-xl md:rounded-[2rem] shadow-[8px_8px_0px_0px_#2E1065]" 
           style={{ 
             display: 'grid', 
             // FIX 1: Menggunakan minmax(0, 1fr) KUNCI UTAMA agar kotak membatu dan tidak melar saat diisi teks
             gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
             gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`,
             // FIX 2: Memaksa bentuk papan agar rasio tinggi & lebarnya selalu 1:1 (Persegi Sempurna)
             aspectRatio: '1 / 1',
             width: 'min(100%, calc(100vh - 8rem))',
             gap: gridSize >= 15 ? '2px' : '4px' 
           }}>
        {grid.map((row, y) => row.map((cell, x) => {
            const isBlack = cell === null;
            const startNumber = placedWords.find(w => w.x === x && w.y === y)?.number;
            
            let isRevealed = false;
            let isPartOfActiveWord = false;
            let isCellActive = activeCell?.x === x && activeCell?.y === y;

            if (!isBlack) {
              const coveringWords = placedWords.filter(w => (w.isHorizontal && w.y === y && x >= w.x && x < w.x + w.word.length) || (!w.isHorizontal && w.x === x && y >= w.y && y < w.y + w.word.length));
              if (coveringWords.some(w => revealedWords.includes(w.word))) isRevealed = true;
              if (activeWord && coveringWords.some(w => w.word === activeWord.word)) isPartOfActiveWord = true;
            }

            const displayChar = isRevealed ? cell : (userAnswers[`${x}-${y}`] || '');

            return (
              <div 
                key={`${x}-${y}`} 
                // FIX 3: Tambahkan overflow-hidden agar teks super besar dipotong rapi alih-alih meledakkan kotak
                className={`relative flex items-center justify-center font-black select-none transition-all duration-150 w-full h-full rounded-sm md:rounded-md overflow-hidden
                  text-sm sm:text-base md:text-xl lg:text-2xl
                  ${isBlack ? 'bg-transparent' : 'bg-white border-[1px] md:border-[2px] border-slate-300 shadow-sm text-slate-800'} 
                  ${!isBlack && interactive ? 'cursor-pointer hover:bg-[#F0F9FF] hover:scale-110 hover:z-10' : ''}
                  ${isPartOfActiveWord && !isRevealed && !isCellActive ? 'bg-[#7DD3FC] border-[#0284C7]' : ''}
                  ${isCellActive ? 'bg-[#FDE047] border-[#EAB308] ring-2 md:ring-4 ring-[#FEF08A] z-20 scale-110 shadow-lg text-yellow-900' : ''}
                  ${isRevealed ? 'bg-[#86EFAC] text-[#14532D] border-[#16A34A]' : ''}
                `} 
                onClick={() => { if (!isBlack && interactive && onCellClick) onCellClick(x, y); }}
              >
                {!isBlack && startNumber && <span className={`absolute top-[1px] left-[2px] md:top-[2px] md:left-1 text-[7px] md:text-[10px] font-black leading-none ${isRevealed ? 'text-[#166534]' : 'text-slate-500'}`}>{startNumber}</span>}
                {/* FIX 4: leading-none menjaga teks selalu berada presisi di tengah vertikal */}
                {!isBlack && <span className="uppercase animate-fade-in leading-none">{displayChar}</span>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
