import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, 
  onSnapshot, deleteDoc 
} from 'firebase/firestore';
import { 
  Settings, Users, Play, Plus, Trash2, Edit, Save, 
  LogOut, CheckCircle, XCircle, Trophy, Key, ArrowLeft, RefreshCw, ClipboardType
} from 'lucide-react';

// --- Konfigurasi Firebase Asli ---
const firebaseConfig = {
  apiKey: "AIzaSyB-1el0D6c3dRSGnm0G52yP3gopaPKpqGE",
  authDomain: "tts-digital.firebaseapp.com",
  projectId: "tts-digital",
  storageBucket: "tts-digital.firebasestorage.app",
  messagingSenderId: "943079047995",
  appId: "1:943079047995:web:5d4efde0b3e6529845ed1e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID = 'tts-digital-app';

// --- Mesin Pembuat TTS (Generator) ---
const generateCrossword = (wordsList, size) => {
  if (!wordsList || wordsList.length === 0) return { grid: [], placedWords: [] };
  const words = [...wordsList].sort((a, b) => b.word.length - a.word.length);
  const grid = Array(size).fill(null).map(() => Array(size).fill(null));
  const placedWords = [];

  const canPlace = (word, startX, startY, isHorizontal) => {
    if (isHorizontal) {
      if (startX + word.length > size) return false;
      for (let i = 0; i < word.length; i++) {
        const x = startX + i;
        const y = startY;
        if (grid[y][x] !== null && grid[y][x] !== word[i]) return false;
        if (grid[y][x] === null) {
          if (y > 0 && grid[y - 1][x] !== null) return false;
          if (y < size - 1 && grid[y + 1][x] !== null) return false;
        }
      }
      if (startX > 0 && grid[startY][startX - 1] !== null) return false;
      if (startX + word.length < size && grid[startY][startX + word.length] !== null) return false;
    } else {
      if (startY + word.length > size) return false;
      for (let i = 0; i < word.length; i++) {
        const x = startX;
        const y = startY + i;
        if (grid[y][x] !== null && grid[y][x] !== word[i]) return false;
        if (grid[y][x] === null) {
          if (x > 0 && grid[y][x - 1] !== null) return false;
          if (x < size - 1 && grid[y][x + 1] !== null) return false;
        }
      }
      if (startY > 0 && grid[startY - 1][startX] !== null) return false;
      if (startY + word.length < size && grid[startY + word.length][startX] !== null) return false;
    }
    return true;
  };

  const placeWord = (wordObj, startX, startY, isHorizontal) => {
    const word = wordObj.word.toUpperCase();
    for (let i = 0; i < word.length; i++) {
      if (isHorizontal) grid[startY][startX + i] = word[i];
      else grid[startY + i][startX] = word[i];
    }
    placedWords.push({ 
      ...wordObj, word, x: startX, y: startY, isHorizontal, number: placedWords.length + 1 
    });
  };

  const firstWord = words[0];
  const startX = Math.floor((size - firstWord.word.length) / 2);
  const startY = Math.floor(size / 2);
  placeWord(firstWord, Math.max(0, startX), startY, true);

  for (let i = 1; i < words.length; i++) {
    const currentWord = words[i].word.toUpperCase();
    let placed = false;
    for (let pw of placedWords) {
      if (placed) break;
      for (let j = 0; j < currentWord.length; j++) {
        if (placed) break;
        const char = currentWord[j];
        for (let k = 0; k < pw.word.length; k++) {
          if (pw.word[k] === char) {
            const intersectX = pw.isHorizontal ? pw.x + k : pw.x;
            const intersectY = pw.isHorizontal ? pw.y : pw.y + k;
            const newIsHoriz = !pw.isHorizontal;
            const newStartX = newIsHoriz ? intersectX - j : intersectX;
            const newStartY = newIsHoriz ? intersectY : intersectY - j;

            if (newStartX >= 0 && newStartY >= 0 && canPlace(currentWord, newStartX, newStartY, newIsHoriz)) {
              placeWord(words[i], newStartX, newStartY, newIsHoriz);
              placed = true;
              break;
            }
          }
        }
      }
    }
    if (!placed) {
      for(let r = 0; r < size && !placed; r++) {
         for(let c = 0; c < size && !placed; c++) {
            if (canPlace(currentWord, c, r, true)) { placeWord(words[i], c, r, true); placed = true; }
            else if (canPlace(currentWord, c, r, false)) { placeWord(words[i], c, r, false); placed = true; }
         }
      }
    }
  }
  return { grid, placedWords };
};

// --- Komponen Utama ---
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('license'); 
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState([]);
  const [currentPackage, setCurrentPackage] = useState(null);
  const [sessionPin, setSessionPin] = useState('');
  const [sessionData, setSessionData] = useState(null);
  const [playerTeam, setPlayerTeam] = useState('');
  const [licenseKey, setLicenseKey] = useState('');

  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (e) { console.error("Gagal login anonim:", e); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || view !== 'dashboard') return;
    const fetchPackages = async () => {
      try {
        const colRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'tts_packages');
        const snap = await getDocs(colRef);
        setPackages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error("Gagal mengambil data paket", e); }
    };
    fetchPackages();
  }, [user, view]);

  const handleLicenseCheck = (e) => {
    e.preventDefault();
    if (licenseKey === 'GURU123') setView('dashboard');
    else alert("Kode Lisensi Salah! (Gunakan: GURU123)");
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-xl text-blue-600 font-bold">Memuat TTS Digital...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-200">
      <header className="bg-indigo-600 text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6" />
          <h1 className="text-2xl font-bold tracking-wider">TTS DIGITAL EDU</h1>
        </div>
        {view !== 'license' && view !== 'role_select' && (
          <button onClick={() => setView('role_select')} className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-700 px-3 py-1 rounded transition">
            <LogOut className="w-4 h-4" /> Keluar
          </button>
        )}
      </header>

      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        {view === 'license' && (
          <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-xl shadow-lg border border-slate-200">
            <h2 className="text-2xl font-bold text-center mb-6 text-slate-700">Masuk ke TTS Digital</h2>
            <div className="flex flex-col gap-4">
              <button onClick={() => setView('role_select')} className="w-full bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg font-bold flex items-center justify-center gap-2 transition">
                <Users className="w-5 h-5"/> Masuk sebagai Siswa (Multiplayer)
              </button>
              <div className="relative flex py-5 items-center">
                  <div className="flex-grow border-t border-gray-300"></div>
                  <span className="flex-shrink-0 mx-4 text-gray-400">Atau</span>
                  <div className="flex-grow border-t border-gray-300"></div>
              </div>
              <form onSubmit={handleLicenseCheck} className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-slate-600">Akses Dasbor Guru</label>
                <div className="relative">
                  <Key className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                  <input type="password" value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)} placeholder="Masukkan Kode (GURU123)" className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" required />
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg font-bold transition">Akses Dasbor</button>
              </form>
            </div>
          </div>
        )}

        {view === 'role_select' && (
          <PlayerJoin db={db} onJoin={(s, t) => { setSessionData(s); setPlayerTeam(t); setView('player_play'); }} onBack={() => setView('license')} />
        )}

        {view === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div>
                <h2 className="text-3xl font-bold text-slate-800">Dasbor Guru</h2>
                <p className="text-slate-500 mt-1">Kelola Paket Soal Teka-Teki Silang</p>
              </div>
              <button onClick={() => { setCurrentPackage({ title: '', jenjang: '', kelas: '', mapel: '', gridSize: 15, words: [] }); setView('editor'); }} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 shadow-sm transition">
                <Plus className="w-5 h-5" /> Buat Paket Baru
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {packages.length === 0 ? (
                <div className="col-span-full text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">Belum ada paket soal. Klik "Buat Paket Baru" untuk mulai.</div>
              ) : packages.map(pkg => (
                <div key={pkg.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition flex flex-col h-full">
                  <div className="mb-4 flex-grow">
                    <div className="flex gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded">{pkg.jenjang}</span>
                      <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">Kls {pkg.kelas}</span>
                      <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded">{pkg.mapel}</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-1">{pkg.title}</h3>
                    <p className="text-sm text-slate-500">{pkg.words?.length || 0} Kata • Grid: {pkg.gridSize}x{pkg.gridSize}</p>
                  </div>
                  <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-100">
                    <button onClick={() => { setCurrentPackage(pkg); setView('solo'); }} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded font-semibold flex items-center justify-center gap-2 transition"><Play className="w-4 h-4" /> Main Solo</button>
                    <button onClick={() => { setCurrentPackage(pkg); setView('host_lobby'); }} className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 rounded font-semibold flex items-center justify-center gap-2 transition"><Users className="w-4 h-4" /> Buka Multiplayer</button>
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => { setCurrentPackage(pkg); setView('editor'); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded font-semibold flex items-center justify-center gap-1 transition"><Edit className="w-4 h-4" /> Edit</button>
                      <button onClick={async () => { if(window.confirm('Yakin hapus?')) { await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'tts_packages', pkg.id)); setPackages(packages.filter(p => p.id !== pkg.id)); } }} className="bg-red-50 hover:bg-red-100 text-red-600 p-2 rounded transition"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'editor' && <GameEditor initialData={currentPackage} user={user} db={db} appId={APP_ID} onSave={() => setView('dashboard')} onCancel={() => setView('dashboard')} />}
        {view === 'solo' && currentPackage && <PlaySolo gamePackage={currentPackage} onBack={() => setView('dashboard')} />}
        {view === 'host_lobby' && currentPackage && <HostLobby gamePackage={currentPackage} user={user} db={db} onStart={(p, d) => { setSessionPin(p); setSessionData(d); setView('host_play'); }} onCancel={() => setView('dashboard')} />}
        {view === 'host_play' && sessionData && <HostPlay sessionPin={sessionPin} db={db} onEnd={() => setView('dashboard')} />}
        {view === 'player_play' && sessionData && <PlayerPlay sessionData={sessionData} teamName={playerTeam} db={db} onLeave={() => setView('role_select')} />}
      </main>
    </div>
  );
}

// --- GAME EDITOR ---
function GameEditor({ initialData, user, db, appId, onSave, onCancel }) {
  const [formData, setFormData] = useState(initialData);
  const [newWord, setNewWord] = useState('');
  const [newClue, setNewClue] = useState('');
  const [saving, setSaving] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const addWord = () => {
    if (!newWord.trim() || !newClue.trim()) return;
    const cleanWord = newWord.trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (cleanWord.length < 2) return alert("Kata minimal 2 huruf (hanya huruf).");
    setFormData(prev => ({ ...prev, words: [...prev.words, { word: cleanWord, clue: newClue.trim() }] }));
    setNewWord(''); setNewClue('');
  };

  const handleBulkImport = () => {
    const lines = bulkText.split('\n');
    const newWordsList = [];
    let skipped = 0;
    
    lines.forEach(line => {
      if (line.includes('-') || line.includes('=') || line.includes(':')) {
         const parts = line.split(/[-=:]/);
         const word = parts[0].trim().toUpperCase().replace(/[^A-Z]/g, '');
         const clue = parts.slice(1).join('-').trim();
         if (word.length >= 2 && clue.length > 0) newWordsList.push({ word, clue });
         else skipped++;
      } else {
         if(line.trim() !== '') skipped++;
      }
    });

    if (newWordsList.length > 0) {
       setFormData(prev => ({ ...prev, words: [...prev.words, ...newWordsList] }));
       setBulkText(''); setBulkMode(false);
       alert(`Berhasil impor ${newWordsList.length} kata! ${skipped > 0 ? `(${skipped} baris diabaikan)` : ''}`);
    } else {
       alert("Tidak ada kata valid. Format harus: KATA - Petunjuk");
    }
  };

  const handleSave = async () => {
    if (!formData.title) return alert("Nama Paket harus diisi!");
    if (formData.words.length < 2) return alert("Minimal masukkan 2 kata!");
    
    if (!user) {
      return alert("Akun Anda belum tersambung dengan Firebase Authentication.");
    }

    setSaving(true);
    try {
      const colRef = collection(db, 'artifacts', appId, 'users', user.uid, 'tts_packages');
      if (formData.id) await setDoc(doc(colRef, formData.id), formData);
      else {
        const newDocRef = doc(colRef);
        await setDoc(newDocRef, { ...formData, id: newDocRef.id });
      }
      onSave();
    } catch (e) {
      console.error(e);
      alert("Gagal menyimpan. Pastikan Aturan Firestore sudah mengizinkan write."); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
      <div className="flex items-center gap-4 mb-6 pb-4 border-b">
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><ArrowLeft /></button>
        <h2 className="text-2xl font-bold text-slate-800">{formData.id ? 'Edit Paket Game' : 'Buat Paket Game Baru'}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="space-y-4">
          <div><label className="block text-sm font-semibold text-slate-600 mb-1">Nama Paket</label><input type="text" className="w-full border rounded p-2" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Cth: Kosa Kata Hewan" /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="block text-sm font-semibold text-slate-600 mb-1">Jenjang</label><select className="w-full border rounded p-2" value={formData.jenjang} onChange={e => setFormData({...formData, jenjang: e.target.value})}><option value="">Pilih</option><option value="SD">SD</option><option value="SMP">SMP</option><option value="SMA">SMA</option><option value="Umum">Umum</option></select></div>
            <div><label className="block text-sm font-semibold text-slate-600 mb-1">Kelas</label><input type="text" className="w-full border rounded p-2" value={formData.kelas} onChange={e => setFormData({...formData, kelas: e.target.value})} placeholder="Cth: 4, 5, 6" /></div>
            <div><label className="block text-sm font-semibold text-slate-600 mb-1">Grid Size</label><select className="w-full border rounded p-2" value={formData.gridSize} onChange={e => setFormData({...formData, gridSize: Number(e.target.value)})}><option value={10}>10 x 10</option><option value={15}>15 x 15</option><option value={20}>20 x 20</option><option value={25}>25 x 25</option></select></div>
          </div>
          <div><label className="block text-sm font-semibold text-slate-600 mb-1">Mata Pelajaran</label><input type="text" className="w-full border rounded p-2" value={formData.mapel} onChange={e => setFormData({...formData, mapel: e.target.value})} placeholder="Cth: Bahasa Inggris" /></div>
        </div>

        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-slate-700">Input Kata & Petunjuk</h3>
            <button onClick={() => setBulkMode(!bulkMode)} className="text-sm bg-indigo-100 text-indigo-700 px-2 py-1 rounded flex items-center gap-1 font-semibold hover:bg-indigo-200 transition"><ClipboardType className="w-4 h-4"/> {bulkMode ? 'Input Manual' : 'Import Massal'}</button>
          </div>

          {bulkMode ? (
            <div className="flex flex-col gap-2 mb-4 animate-fade-in">
              <p className="text-xs text-slate-500">Format: KATA - Petunjuk. Contoh:<br/>KUCING - Hewan mengeong</p>
              <textarea className="w-full border rounded p-2 h-32 text-sm outline-none focus:ring-2 focus:ring-indigo-300" placeholder="KUCING - Hewan yang suka mengeong&#10;SAPI - Hewan penghasil susu" value={bulkText} onChange={e => setBulkText(e.target.value)}></textarea>
              <button onClick={handleBulkImport} className="bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700">Proses Import</button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 mb-4 animate-fade-in">
              <input type="text" placeholder="Kata Jawaban" className="border rounded p-2 uppercase" value={newWord} onChange={e => setNewWord(e.target.value)} onKeyDown={e => e.key === 'Enter' && document.getElementById('clue-input').focus()} />
              <div className="flex gap-2">
                <input id="clue-input" type="text" placeholder="Petunjuk soal" className="border rounded p-2 flex-grow" value={newClue} onChange={e => setNewClue(e.target.value)} onKeyDown={e => e.key === 'Enter' && addWord()} />
                <button onClick={addWord} className="bg-indigo-600 text-white px-4 rounded hover:bg-indigo-700"><Plus className="w-5 h-5"/></button>
              </div>
            </div>
          )}
          
          <div className="max-h-48 overflow-y-auto border border-slate-200 bg-white rounded">
            {formData.words.length === 0 ? <p className="text-slate-400 text-center py-4 text-sm">Belum ada kata ditambahkan.</p> : (
              <ul className="divide-y">{formData.words.map((w, i) => (
                <li key={i} className="p-2 flex justify-between items-center text-sm">
                  <div><span className="font-bold tracking-wider">{w.word}</span> - <span className="text-slate-600">{w.clue}</span></div>
                  <button onClick={() => setFormData(prev => ({...prev, words: prev.words.filter((_, idx) => idx !== i)}))} className="text-red-500 hover:text-red-700"><XCircle className="w-4 h-4"/></button>
                </li>
              ))}</ul>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onCancel} className="px-6 py-2 rounded font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200">Batal</button>
        <button onClick={handleSave} disabled={saving} className="px-6 py-2 rounded font-semibold text-white bg-green-500 hover:bg-green-600 flex items-center gap-2"><Save className="w-5 h-5" /> {saving ? 'Menyimpan...' : 'Simpan Paket'}</button>
      </div>
    </div>
  );
}

// --- BOARD UI ---
function BoardUI({ gridSize, generatedData, revealedWords = [], onCellClick, interactive = false, activeWord = null, activeCell = null, userAnswers = {} }) {
  const { grid, placedWords } = generatedData;
  if (!grid || grid.length === 0) return <div className="text-center p-10 text-white">Papan gagal dibuat.</div>;

  return (
    <div className="inline-block bg-slate-800 p-2 rounded-lg shadow-xl outline-none" style={{ display: 'grid', gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`, gap: '2px', maxWidth: '100%', overflow: 'auto' }}>
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
              className={`relative flex items-center justify-center font-bold text-lg md:text-xl select-none transition-colors duration-150
                ${isBlack ? 'bg-slate-900' : 'bg-white'} 
                ${!isBlack && interactive ? 'cursor-pointer' : ''}
                ${isPartOfActiveWord && !isRevealed && !isCellActive ? 'bg-indigo-100' : ''}
                ${isCellActive ? 'bg-yellow-300 ring-2 ring-yellow-500 z-10 scale-105 shadow-md' : 'shadow-sm'}
                ${isRevealed ? 'bg-green-50 text-green-700' : 'text-slate-900'}
              `} 
              style={{ width: 'clamp(25px, 4vw, 45px)', height: 'clamp(25px, 4vw, 45px)' }}
              onClick={() => {
                if (!isBlack && interactive && onCellClick) onCellClick(x, y);
              }}
            >
              {!isBlack && startNumber && <span className={`absolute top-0 left-1 text-[8px] md:text-[10px] ${isRevealed ? 'text-green-600' : 'text-slate-500'} font-normal`}>{startNumber}</span>}
              {!isBlack && <span className="uppercase animate-fade-in">{displayChar}</span>}
            </div>
          );
        })
      )}
    </div>
  );
}

// --- MODE SOLO ---
function PlaySolo({ gamePackage, onBack }) {
  const [generatedData, setGeneratedData] = useState(null);
  const [revealedWords, setRevealedWords] = useState([]);
  const [activeWord, setActiveWord] = useState(null);
  const [activeCell, setActiveCell] = useState(null);
  const [userAnswers, setUserAnswers] = useState({});

  useEffect(() => { setGeneratedData(generateCrossword(gamePackage.words, gamePackage.gridSize)); }, [gamePackage]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!activeCell || !activeWord) return;
      const key = e.key.toUpperCase();

      if (/^[A-Z]$/.test(key) && key.length === 1) {
        setUserAnswers(prev => ({ ...prev, [`${activeCell.x}-${activeCell.y}`]: key }));
        if (activeWord.isHorizontal && activeCell.x < activeWord.x + activeWord.word.length - 1) {
          setActiveCell({ x: activeCell.x + 1, y: activeCell.y });
        } else if (!activeWord.isHorizontal && activeCell.y < activeWord.y + activeWord.word.length - 1) {
          setActiveCell({ x: activeCell.x, y: activeCell.y + 1 });
        }
      } else if (e.key === 'Backspace') {
        setUserAnswers(prev => {
          const next = { ...prev };
          delete next[`${activeCell.x}-${activeCell.y}`];
          return next;
        });
        if (activeWord.isHorizontal && activeCell.x > activeWord.x) {
          setActiveCell({ x: activeCell.x - 1, y: activeCell.y });
        } else if (!activeWord.isHorizontal && activeCell.y > activeWord.y) {
          setActiveCell({ x: activeCell.x, y: activeCell.y - 1 });
        }
      } else if (e.key === 'Enter') {
        checkCurrentWord();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCell, activeWord, userAnswers]);

  const handleCellClick = (x, y) => {
    const { placedWords } = generatedData;
    const covering = placedWords.filter(w => (w.isHorizontal && w.y === y && x >= w.x && x < w.x + w.word.length) || (!w.isHorizontal && w.x === x && y >= w.y && y < w.y + w.word.length));
    if (covering.length === 0) return;

    if (activeWord && covering.some(w => w.word === activeWord.word)) {
      if (covering.length > 1) {
        const otherWord = covering.find(w => w.word !== activeWord.word);
        setActiveWord(otherWord);
      }
    } else {
      setActiveWord(covering[0]);
    }
    setActiveCell({ x, y });
  };

  const selectWordFromList = (word) => {
    setActiveWord(word);
    setActiveCell({ x: word.x, y: word.y });
  };

  const checkCurrentWord = () => {
    if (!activeWord) return;
    let currentGuess = '';
    for (let i = 0; i < activeWord.word.length; i++) {
      const cx = activeWord.isHorizontal ? activeWord.x + i : activeWord.x;
      const cy = activeWord.isHorizontal ? activeWord.y : activeWord.y + i;
      currentGuess += (userAnswers[`${cx}-${cy}`] || ' ');
    }
    
    if (currentGuess.trim().length < activeWord.word.length) {
      alert("Lengkapi dulu kotak yang kosong!");
      return;
    }

    if (currentGuess === activeWord.word) {
      if (!revealedWords.includes(activeWord.word)) setRevealedWords([...revealedWords, activeWord.word]);
      setActiveWord(null); setActiveCell(null);
    } else {
      alert("Yah, ada huruf yang salah. Coba lagi!");
    }
  };

  if (!generatedData) return <div className="flex h-[85vh] items-center justify-center font-bold text-slate-500 animate-pulse">Menyiapkan Papan TTS...</div>;
  const isComplete = generatedData.placedWords.length > 0 && revealedWords.length === generatedData.placedWords.length;

  return (
    <div className="flex flex-col h-[85vh]">
      <div className="flex justify-between items-center mb-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <button onClick={onBack} className="p-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-600"><ArrowLeft className="w-5 h-5"/></button>
        <div className="text-center font-bold text-slate-700">SOLO MODE - Ketik langsung di papan!</div>
        <button onClick={() => setRevealedWords(generatedData.placedWords.map(w => w.word))} className="text-sm bg-amber-100 text-amber-700 px-3 py-1 rounded font-semibold hover:bg-amber-200 transition">Buka Semua</button>
      </div>
      <div className="flex-grow flex flex-col lg:flex-row gap-6 overflow-hidden">
        <div className="lg:w-2/3 bg-slate-100 rounded-xl border border-slate-300 p-4 flex items-center justify-center overflow-auto relative shadow-inner">
          {isComplete && <div className="absolute inset-0 bg-white/90 z-20 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in"><Trophy className="w-24 h-24 text-yellow-500 mb-4 drop-shadow-md" /><h2 className="text-4xl font-black text-slate-800 tracking-tight">Luar Biasa!</h2></div>}
          <BoardUI gridSize={gamePackage.gridSize} generatedData={generatedData} revealedWords={revealedWords} activeWord={activeWord} activeCell={activeCell} userAnswers={userAnswers} onCellClick={handleCellClick} interactive={true} />
        </div>
        
        <div className="lg:w-1/3 bg-white rounded-xl shadow-lg border flex flex-col overflow-hidden">
          {activeWord ? (
            <div className="p-6 bg-indigo-600 text-white border-b shadow-md z-10 animate-fade-in">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-black bg-white text-indigo-700 px-3 py-1 rounded-full uppercase tracking-wider">{activeWord.isHorizontal ? 'MENDATAR' : 'MENURUN'} - {activeWord.number}</span>
                <button onClick={() => {setActiveWord(null); setActiveCell(null);}} className="bg-indigo-500 p-1 rounded-full hover:bg-indigo-400"><XCircle className="w-5 h-5"/></button>
              </div>
              <p className="text-xl font-medium mb-6 leading-snug">{activeWord.clue}</p>
              <div className="flex gap-2">
                <button onClick={checkCurrentWord} className="flex-grow bg-green-500 hover:bg-green-400 text-white py-3 rounded-lg font-bold text-lg shadow-sm transition">Cek Jawaban (Enter)</button>
              </div>
              <button onClick={() => { setRevealedWords([...revealedWords, activeWord.word]); setActiveWord(null); setActiveCell(null); }} className="w-full mt-4 text-sm text-indigo-200 hover:text-white underline">Bocorkan Jawaban</button>
            </div>
          ) : <div className="p-8 bg-slate-50 border-b text-center flex flex-col items-center justify-center"><div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-3"><Play className="w-6 h-6 text-indigo-600"/></div><p className="text-slate-500 font-medium">Klik kotak di papan untuk mulai menjawab pertanyaan.</p></div>}
          
          <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-6 bg-slate-50">
            {['Mendatar', 'Menurun'].map((dir, i) => (
              <div key={dir}>
                <h3 className="font-bold text-slate-400 mb-3 border-b-2 border-slate-200 pb-1 uppercase tracking-widest text-sm">{dir}</h3>
                <ul className="space-y-2">
                  {generatedData.placedWords.filter(w => (i === 0 ? w.isHorizontal : !w.isHorizontal)).sort((a,b) => a.number - b.number).map(w => {
                    const isRevealed = revealedWords.includes(w.word);
                    const isActive = activeWord?.word === w.word;
                    return (
                    <li key={w.number} onClick={() => selectWordFromList(w)} className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border-l-4 ${isRevealed ? 'border-green-500 bg-green-50/50 opacity-60' : isActive ? 'border-indigo-500 bg-indigo-50 shadow-md transform -translate-y-0.5' : 'border-transparent bg-white shadow-sm hover:border-slate-300'}`}>
                      <span className={`font-bold mr-2 ${isActive ? 'text-indigo-600' : 'text-slate-700'}`}>{w.number}.</span> {isRevealed ? <span className="font-black tracking-widest text-green-600 uppercase">{w.word}</span> : <span className="text-slate-600">{w.clue}</span>}
                    </li>
                  )})}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- MULTIPLAYER COMPONENTS (Jalur Database Diperbaiki) ---
function HostLobby({ gamePackage, user, db, onStart, onCancel }) {
  const [pin] = useState(Math.floor(100000 + Math.random() * 900000).toString());
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      const data = { 
        pin, hostId: user.uid, status: 'playing', title: gamePackage.title, 
        gridSize: gamePackage.gridSize, 
        generatedData: generateCrossword(gamePackage.words, gamePackage.gridSize), 
        revealedWords: [], teams: {}, createdAt: new Date().toISOString() 
      };
      // Langsung simpan di koleksi utama 'tts_sessions' agar lolos aturan Firestore
      await setDoc(doc(db, 'tts_sessions', pin), data);
      onStart(pin, data);
    } catch (error) {
      console.error(error);
      alert("Gagal membuat ruangan. Periksa koneksi atau Firestore Rules.");
      setStarting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-xl text-center mt-10 border border-slate-200">
      <h2 className="text-3xl font-bold text-slate-800 mb-2">Mulai Multiplayer</h2>
      <p className="text-slate-500 mb-8">Minta siswa masuk menggunakan PIN ini di perangkat mereka.</p>
      
      <div className="bg-indigo-50 border-2 border-indigo-200 p-8 rounded-xl mb-8 shadow-inner">
        <p className="text-sm font-semibold text-indigo-600 mb-2 uppercase tracking-widest">PIN Ruangan</p>
        <p className="text-6xl font-black text-indigo-900 tracking-widest">{pin}</p>
      </div>

      <div className="flex gap-4">
        <button onClick={onCancel} className="flex-1 py-4 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition">Batal</button>
        <button onClick={handleStart} disabled={starting} className="flex-1 py-4 font-bold text-white bg-green-500 hover:bg-green-600 rounded-xl shadow-lg transition flex justify-center items-center gap-2">
          {starting ? 'Memproses...' : 'Buka Ruangan'}
        </button>
      </div>
    </div>
  );
}

function HostPlay({ sessionPin, db, onEnd }) {
  const [sessionData, setSessionData] = useState(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'tts_sessions', sessionPin), (snap) => {
      if (snap.exists()) setSessionData(snap.data());
    });
    return () => unsubscribe();
  }, [sessionPin, db]);

  if (!sessionData) return <div className="text-center mt-20 text-xl font-bold text-indigo-600 animate-pulse">Menyiapkan Ruangan...</div>;
  
  const teams = Object.entries(sessionData.teams || {}).map(([name, d]) => ({ name, ...d })).sort((a,b) => b.score - a.score);
  const isComplete = sessionData.generatedData.placedWords.length > 0 && sessionData.revealedWords.length === sessionData.generatedData.placedWords.length;

  return (
    <div className="flex flex-col h-[85vh]">
      <div className="flex justify-between items-center mb-4 bg-white p-4 rounded-lg shadow-md border-l-4 border-l-indigo-500">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{sessionData.title} <span className="bg-red-500 text-white text-xs px-2 py-1 rounded ml-2 animate-pulse font-normal">LIVE</span></h2>
          <p className="text-slate-500">PIN Masuk: <span className="font-black text-indigo-700 text-lg tracking-widest">{sessionPin}</span></p>
        </div>
        <button onClick={async () => { if(window.confirm('Akhiri sesi permainan ini?')) { await deleteDoc(doc(db, 'tts_sessions', sessionPin)); onEnd(); } }} className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded font-bold transition">Tutup Room</button>
      </div>

      <div className="flex-grow flex flex-col lg:flex-row gap-6 overflow-hidden">
        <div className="lg:w-3/4 bg-slate-900 rounded-xl p-4 flex items-center justify-center overflow-auto shadow-2xl relative border-4 border-slate-800">
          {isComplete && (
            <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in">
              <Trophy className="w-32 h-32 text-yellow-500 mb-6 drop-shadow-[0_0_15px_rgba(234,179,8,1)]" />
              <h2 className="text-5xl font-black text-white tracking-widest">PERMAINAN SELESAI</h2>
              {teams.length > 0 && (
                <div className="mt-6 text-center">
                  <p className="text-xl text-yellow-300">Pemenang Utama:</p>
                  <p className="text-4xl font-bold text-yellow-400">{teams[0].name} ({teams[0].score} Poin)</p>
                </div>
              )}
            </div>
          )}
          <BoardUI gridSize={sessionData.gridSize} generatedData={sessionData.generatedData} revealedWords={sessionData.revealedWords} interactive={false} />
        </div>
        
        <div className="lg:w-1/4 bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col overflow-hidden">
          <div className="bg-indigo-600 text-white p-4 text-center">
            <h3 className="font-bold text-lg flex items-center justify-center gap-2"><Trophy className="w-5 h-5"/> Klasemen Siswa</h3>
          </div>
          <div className="flex-grow overflow-y-auto p-3 bg-slate-50">
            {teams.length === 0 ? (
              <p className="text-center text-slate-400 mt-10 text-sm italic">Menunggu siswa bergabung...</p>
            ) : (
              <ul className="space-y-3">
                {teams.map((t, i) => (
                  <li key={t.name} className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>{i+1}</span>
                      <span className="font-bold text-slate-700 truncate max-w-[120px]">{t.name}</span>
                    </div>
                    <span className="font-black text-indigo-600">{t.score}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerJoin({ db, onJoin, onBack }) {
  const [pin, setPin] = useState(''); 
  const [teamName, setTeamName] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoin = async (e) => {
    e.preventDefault();
    setJoining(true);
    try {
      const ref = doc(db, 'tts_sessions', pin.trim());
      const snap = await getDoc(ref);
      
      if (snap.exists() && snap.data().status === 'playing') {
        const data = snap.data();
        const currentTeams = data.teams || {};
        
        if (!currentTeams[teamName]) {
          currentTeams[teamName] = { score: 0 };
          await updateDoc(ref, { teams: currentTeams });
        }
        onJoin({ ...data, teams: currentTeams }, teamName);
      } else {
        alert("PIN tidak valid atau sesi belum dimulai Guru.");
      }
    } catch (error) {
      console.error(error);
      alert("Gagal bergabung. Periksa koneksi.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-xl shadow-2xl border border-indigo-100">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-black text-indigo-900 tracking-tight">Masuk Game</h2>
        <p className="text-slate-500 mt-2">Minta PIN pada Guru Anda</p>
      </div>
      <form onSubmit={handleJoin} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">PIN Ruangan</label>
          <input type="text" placeholder="Contoh: 123456" className="w-full text-center text-2xl font-bold tracking-widest border-2 border-indigo-200 rounded-lg p-3 focus:border-indigo-500 focus:ring-4 outline-none transition" value={pin} onChange={e=>setPin(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Nama Siswa / Kelompok</label>
          <input type="text" placeholder="Contoh: Kelompok 1" className="w-full border-2 border-slate-200 rounded-lg p-3 focus:border-indigo-500 focus:ring-4 outline-none transition" value={teamName} onChange={e=>setTeamName(e.target.value)} required />
        </div>
        <button type="submit" disabled={joining} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg p-4 rounded-xl shadow-lg transition mt-4">
          {joining ? 'Memeriksa...' : 'Masuk Sekarang!'}
        </button>
        <button type="button" onClick={onBack} className="w-full text-slate-500 hover:text-slate-700 mt-2 font-semibold text-sm">Kembali</button>
      </form>
    </div>
  );
}

function PlayerPlay({ sessionData, teamName, db, onLeave }) {
  const [localData, setLocalData] = useState(sessionData);
  const [activeQ, setActiveQ] = useState(null);
  const [guess, setGuess] = useState('');
  const [feedback, setFeedback] = useState(null); 

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'tts_sessions', localData.pin), (snap) => {
      if (snap.exists()) setLocalData(snap.data()); 
      else { alert("Sesi permainan ditutup oleh Guru."); onLeave(); }
    });
    return () => unsubscribe();
  }, [localData.pin, db, onLeave]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const answer = guess.trim().toUpperCase();

    if (answer === activeQ.word) {
      try {
        const ref = doc(db, 'tts_sessions', localData.pin);
        const snap = await getDoc(ref);
        
        if (snap.exists()) {
          const currentData = snap.data();
          if (!currentData.revealedWords.includes(activeQ.word)) {
             const newTeams = { ...currentData.teams };
             newTeams[teamName].score += 10;
             await updateDoc(ref, { revealedWords: [...currentData.revealedWords, activeQ.word], teams: newTeams });
             setFeedback({ type: 'success', msg: 'HEBAT! +10 Poin' });
          } else {
             setFeedback({ type: 'error', msg: 'Yah, keduluan kelompok lain!' });
          }
        }
      } catch (err) { console.error(err); }

      setTimeout(() => { setActiveQ(null); setFeedback(null); setGuess(''); }, 2000);
    } else {
      setFeedback({ type: 'error', msg: 'Jawaban salah, coba lagi!' });
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  const myScore = localData.teams?.[teamName]?.score || 0;
  const isComplete = localData.generatedData.placedWords.length > 0 && localData.revealedWords.length === localData.generatedData.placedWords.length;

  if (isComplete) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-xl shadow-2xl text-center animate-fade-in">
        <Trophy className="w-24 h-24 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-slate-800">Permainan Selesai!</h2>
        <p className="text-xl mt-4">Skor Akhir Anda:</p>
        <p className="text-5xl font-black text-indigo-600 mt-2">{myScore}</p>
        <p className="text-sm text-slate-500 mt-6">Lihat layar utama guru untuk klasemen lengkap.</p>
        <button onClick={onLeave} className="mt-8 bg-slate-100 px-6 py-2 rounded font-bold hover:bg-slate-200">Keluar</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[85vh]">
      <div className="bg-indigo-600 text-white rounded-xl shadow-lg p-4 mb-4 flex justify-between items-center">
        <div><p className="text-xs text-indigo-200 uppercase font-bold tracking-wider">Tim Anda</p><h2 className="text-xl font-bold">{teamName}</h2></div>
        <div className="text-right"><p className="text-xs text-indigo-200 uppercase font-bold tracking-wider">Skor</p><p className="text-2xl font-black">{myScore}</p></div>
      </div>

      {activeQ ? (
        <div className="bg-white rounded-xl shadow-md p-6 border-2 border-indigo-100 mb-4 relative overflow-hidden animate-fade-in">
          {feedback && (
            <div className={`absolute top-0 left-0 w-full p-2 text-center text-white font-bold text-sm z-10 ${feedback.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
              {feedback.msg}
            </div>
          )}
          <div className="flex justify-between items-center mb-4 mt-4">
            <span className="text-xs font-bold bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full uppercase">{activeQ.isHorizontal?'Mendatar':'Menurun'} {activeQ.number}</span>
            <button onClick={()=>{setActiveQ(null); setFeedback(null);}} className="text-slate-400 hover:bg-slate-100 p-1 rounded-full"><XCircle/></button>
          </div>
          <p className="text-xl font-bold my-4 text-slate-800">{activeQ.clue}</p>
          <form onSubmit={handleSubmit}>
            <input autoFocus type="text" placeholder={`${activeQ.word.length} HURUF`} className="w-full border-2 border-slate-200 rounded-lg p-4 text-center text-2xl font-black uppercase tracking-widest focus:border-indigo-500 outline-none mb-4" value={guess} onChange={e=>setGuess(e.target.value.toUpperCase())} maxLength={activeQ.word.length} />
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-bold text-lg shadow-md transition">Kirim Jawaban</button>
          </form>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md p-6 mb-4 text-center text-slate-500 font-medium">Pilih pertanyaan di bawah! Siapa cepat dia dapat poin.</div>
      )}

      <div className="flex-grow overflow-y-auto bg-white rounded-xl shadow-md p-4 border border-slate-200">
        {['Mendatar', 'Menurun'].map((dir, i) => (
          <div key={dir} className="mb-6">
            <h4 className="font-bold text-slate-400 border-b-2 pb-1 mb-3 uppercase tracking-widest text-sm">{dir}</h4>
            <ul className="space-y-3">
            {localData.generatedData.placedWords.filter(w => (i === 0 ? w.isHorizontal : !w.isHorizontal)).sort((a,b) => a.number - b.number).map(w => {
              const isAnswered = localData.revealedWords.includes(w.word);
              return (
                <li key={w.number} onClick={() => !isAnswered && setActiveQ(w)} className={`p-4 rounded-lg border-2 flex gap-3 transition ${isAnswered ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 cursor-pointer hover:border-indigo-300 shadow-sm'}`}>
                  <span className={`font-bold ${isAnswered ? 'text-slate-400' : 'text-indigo-600'}`}>{w.number}.</span>
                  <span className={`flex-grow font-medium ${isAnswered ? 'line-through text-slate-400' : 'text-slate-700'}`}>{w.clue}</span>
                  {isAnswered && <CheckCircle className="text-green-500 w-5 h-5 flex-shrink-0" />}
                </li>
              )
            })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}