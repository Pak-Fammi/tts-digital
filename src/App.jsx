// --- BOARD UI (PERBAIKAN KOTAK TUMPANG TINDIH) ---
function BoardUI({ gridSize, generatedData, revealedWords = [], onCellClick, interactive = false, activeWord = null, activeCell = null, userAnswers = {} }) {
  let grid = generatedData?.grid;
  if (!grid && generatedData?.gridString) grid = JSON.parse(generatedData.gridString);
  const placedWords = generatedData?.placedWords || [];

  if (!grid || grid.length === 0) return <div className="text-center p-10 font-black text-slate-400">Papan gagal dibuat. Pastikan kata-katanya bisa bersilangan!</div>;

  return (
    <div className="w-full max-w-full overflow-x-auto overflow-y-auto p-2 md:p-6 custom-scrollbar flex justify-center">
      <div className="inline-block bg-[#E0F2FE] border-4 border-[#7DD3FC] p-4 md:p-6 rounded-[2rem] shadow-[10px_10px_0px_0px_#7DD3FC]" 
           style={{ 
             display: 'grid', 
             // FIX: Pindahkan paksaan ukuran (clamp) langsung ke konfigurasi Grid-nya
             gridTemplateColumns: `repeat(${gridSize}, clamp(35px, 5vw, 60px))`, 
             gridAutoRows: `clamp(35px, 5vw, 60px)`,
             gap: '6px' 
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
                // FIX: Kotak diatur w-full dan h-full agar pas 100% dengan ruang grid yang disediakan
                className={`relative flex items-center justify-center font-black text-2xl md:text-3xl select-none transition-all duration-150 w-full h-full
                  ${isBlack ? 'bg-transparent' : 'bg-white border-[3px] border-slate-200 rounded-xl shadow-sm text-slate-700'} 
                  ${!isBlack && interactive ? 'cursor-pointer hover:bg-sky-50 hover:scale-105 hover:z-10' : ''}
                  ${isPartOfActiveWord && !isRevealed && !isCellActive ? 'bg-[#BAE6FD] border-[#38BDF8]' : ''}
                  ${isCellActive ? 'bg-[#FDE047] border-[#EAB308] ring-4 ring-[#FEF08A] z-20 scale-110 shadow-lg text-yellow-900' : ''}
                  ${isRevealed ? 'bg-[#86EFAC] text-[#14532D] border-[#22C55E]' : ''}
                `} 
                onClick={() => { if (!isBlack && interactive && onCellClick) onCellClick(x, y); }}
              >
                {!isBlack && startNumber && <span className={`absolute top-1 left-1.5 text-[10px] md:text-xs font-black ${isRevealed ? 'text-[#166534]' : 'text-slate-400'}`}>{startNumber}</span>}
                {!isBlack && <span className="uppercase animate-fade-in">{displayChar}</span>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}