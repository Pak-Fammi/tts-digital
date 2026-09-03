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
  LogOut, CheckCircle, XCircle, Trophy, Key, ArrowLeft, ClipboardType,
  Volume2, VolumeX, Maximize, Minimize, Eye, EyeOff, Wand2
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

// --- ASET AUDIO ---
const SOUNDS = {
  type: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  correct: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
  wrong: 'https://assets.mixkit.co/active_storage/sfx/138/138-preview.mp3', 
  win: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3', 
  bgm: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3'
};

const AUDIO_POOL = {
  type: new Audio(SOUNDS.type),
  correct: new Audio(SOUNDS.correct),
  wrong: new Audio(SOUNDS.wrong),
  win: new Audio(SOUNDS.win)
};
AUDIO_POOL.type.volume = 0.3;
AUDIO_POOL.correct.volume = 0.6;
AUDIO_POOL.wrong.volume = 0.6;
AUDIO_POOL.win.volume = 0.8;

const playSFX = (type, isMuted) => {
  if (isMuted) return;
  const sound = AUDIO_POOL[type].cloneNode();
  sound.volume = AUDIO_POOL[type].volume;
  sound.play().catch(() => {}); 
};

// --- Mesin Pembuat TTS ---
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

  const firstWord = words.shift();
  const startX = Math.floor((size - firstWord.word.length) / 2);
  const startY = Math.floor(size / 2);
  placeWord(firstWord, Math.max(0, startX), startY, true);

  let unplacedWords = [...words];
  let keepTrying = true;

  while (keepTrying && unplacedWords.length > 0) {
    keepTrying = false;
    const stillUnplaced = [];

    for (let i = 0; i < unplacedWords.length; i++) {
      const currentWordObj = unplacedWords[i];
      const currentWord = currentWordObj.word.toUpperCase();
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
                placeWord(currentWordObj, newStartX, newStartY, newIsHoriz);
                placed = true;
                keepTrying = true;
                break;
              }
            }
          }
        }
      }
      if (!placed) stillUnplaced.push(currentWordObj);
    }
    unplacedWords = stillUnplaced;
  }
  
  return { grid, placedWords };
};

// --- Komponen Toast ---
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] px-5 py-3 md:px-6 md:py-4 rounded-xl md:rounded-2xl font-black text-white text-sm md:text-lg shadow-[0_10px_40px_rgb(0,0,0,0.4)] animate-fade-in flex items-center gap-3 ${toast.type === 'error' ? 'bg-[#F43F5E] border-4 border-[#BE123C]' : 'bg-[#10B981] border-4 border-[#047857]'}`}>
      {toast.type === 'error' ? <XCircle className="w-5 h-5 md:w-6 md:h-6" /> : <CheckCircle className="w-5 h-5 md:w-6 md:h-6" />}
      {toast.msg}
    </div>
  );
}

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
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (e) { console.error(e); }
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
      } catch (e) { console.error(e); }
    };
    fetchPackages();
  }, [user, view]);

  const handleLicenseCheck = (e) => {
    e.preventDefault();
    if (licenseKey === 'GURU123') setView('dashboard');
    else alert("Kode Lisensi Salah! (Gunakan: GURU123)"); 
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-2xl text-[#14B8A6] font-black animate-pulse">Menyiapkan Arena...</div>;

  return (
    <div className="min-h-screen bg-[#FFF1F2] text-slate-800 font-sans selection:bg-[#FBCFE8]">
      {view !== 'host_play' && view !== 'player_play' && view !== 'solo' && (
      <header className="bg-[#2DD4BF] text-white p-4 mx-4 mt-4 shadow-[0_4px_0_0_#14B8A6] flex justify-between items-center rounded-3xl z-10 relative">
        <div className="flex items-center gap-3">
          <div className="bg-white p-2 rounded-xl shadow-sm">
            <Settings className="w-6 h-6 text-[#14B8A6]" />
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-widest text-white drop-shadow-md">TTS DIGITAL</h1>
        </div>
        {view !== 'license' && view !== 'role_select' && (
          <button onClick={() => setView('role_select')} className="flex items-center gap-2 bg-[#F43F5E] hover:bg-[#E11D48] shadow-[0_3px_0_0_#BE123C] active:shadow-none active:translate-y-1 px-4 py-2 rounded-2xl font-bold transition-all">
            <LogOut className="w-5 h-5" /> Keluar
          </button>
        )}
      </header>
      )}

      <main className={`${view === 'host_play' || view === 'player_play' || view === 'solo' ? 'p-0' : 'p-2 md:p-4 lg:p-8 max-w-[1400px] mx-auto'}`}>
        {view === 'license' && (
          <div className="max-w-md mx-auto mt-16 bg-white p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.05)] border-4 border-[#FCE7F3]">
            <h2 className="text-3xl font-black text-center mb-8 text-[#F472B6]">Selamat Datang!</h2>
            <div className="flex flex-col gap-5">
              <button onClick={() => setView('role_select')} className="w-full bg-[#38BDF8] hover:bg-[#0EA5E9] text-white p-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-[0_5px_0_0_#0284C7] active:shadow-none active:translate-y-1 transition-all">
                <Users className="w-6 h-6"/> MASUK MAIN (SISWA)
              </button>
              
              <div className="relative flex py-4 items-center">
                  <div className="flex-grow border-t-2 border-dashed border-slate-200"></div>
                  <span className="flex-shrink-0 mx-4 text-slate-400 font-bold text-sm">GURU</span>
                  <div className="flex-grow border-t-2 border-dashed border-slate-200"></div>
              </div>

              <form onSubmit={handleLicenseCheck} className="flex flex-col gap-4">
                <div className="relative">
                  <Key className="w-6 h-6 absolute left-4 top-4 text-[#F472B6]" />
                  <input type={showPassword ? "text" : "password"} value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)} placeholder="Kode Guru (GURU123)" className="w-full pl-12 pr-12 py-4 bg-[#FFF1F2] border-2 border-[#FBCFE8] rounded-2xl font-bold focus:border-[#F472B6] focus:ring-0 outline-none text-slate-700 placeholder-slate-400" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-slate-400 hover:text-[#F472B6] transition">
                    {showPassword ? <EyeOff className="w-6 h-6"/> : <Eye className="w-6 h-6"/>}
                  </button>
                </div>
                <button type="submit" className="w-full bg-[#F472B6] hover:bg-[#EC4899] text-white p-4 rounded-2xl font-black text-lg shadow-[0_5px_0_0_#DB2777] active:shadow-none active:translate-y-1 transition-all">Masuk Dasbor</button>
              </form>
            </div>
          </div>
        )}

        {view === 'role_select' && (
          <PlayerJoin db={db} onJoin={(s, t) => { setSessionData(s); setPlayerTeam(t); setView('player_play'); }} onBack={() => setView('license')} />
        )}

        {view === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border-4 border-[#FCE7F3] gap-4">
              <div>
                <h2 className="text-4xl font-black text-[#F472B6]">Dasbor Guru</h2>
                <p className="text-slate-500 font-semibold mt-1">Buat dan kelola paket TTS ajaib Anda</p>
              </div>
              <button onClick={() => { setCurrentPackage({ title: '', jenjang: '', kelas: '', mapel: '', gridSize: 15, words: [] }); setView('editor'); }} className="bg-[#A7F3D0] hover:bg-[#6EE7B7] text-[#065F46] px-6 py-4 rounded-2xl font-black flex items-center gap-2 shadow-[0_4px_0_0_#34D399] active:shadow-none active:translate-y-1 transition-all w-full md:w-auto justify-center">
                <Plus className="w-6 h-6" /> Buat Paket Baru
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {packages.length === 0 ? (
                <div className="col-span-full text-center py-20 text-slate-400 bg-white rounded-[2rem] border-4 border-dashed border-[#FCE7F3] font-bold text-lg">Belum ada paket soal. Buat yang pertama!</div>
              ) : packages.map(pkg => (
                <div key={pkg.id} className="bg-white p-6 rounded-[2rem] shadow-sm border-4 border-[#E0F2FE] flex flex-col h-full transform hover:scale-[1.02] transition-transform">
                  <div className="mb-6 flex-grow">
                    <div className="flex gap-2 mb-3 flex-wrap">
                      <span className="text-xs font-black bg-[#FEF08A] text-[#854D0E] px-3 py-1 rounded-xl shadow-sm">{pkg.jenjang}</span>
                      <span className="text-xs font-black bg-[#C7D2FE] text-[#3730A3] px-3 py-1 rounded-xl shadow-sm">Kls {pkg.kelas}</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2 leading-tight">{pkg.title}</h3>
                    <p className="text-sm font-semibold text-[#F472B6]">{pkg.words?.length || 0} Kata Terdaftar</p>
                  </div>
                  <div className="flex flex-col gap-3 border-t-2 border-dashed border-slate-100 pt-5">
                    <button onClick={() => { setCurrentPackage(pkg); setView('solo'); }} className="w-full bg-[#BAE6FD] hover:bg-[#7DD3FC] text-[#0369A1] py-3 rounded-xl font-black flex items-center justify-center gap-2 shadow-[0_4px_0_0_#38BDF8] active:shadow-none active:translate-y-1 transition-all"><Play className="w-5 h-5" /> Mode Solo</button>
                    <button onClick={() => { setCurrentPackage(pkg); setView('host_lobby'); }} className="w-full bg-[#DDD6FE] hover:bg-[#C4B5FD] text-[#5B21B6] py-3 rounded-xl font-black flex items-center justify-center gap-2 shadow-[0_4px_0_0_#8B5CF6] active:shadow-none active:translate-y-1 transition-all"><Users className="w-5 h-5" /> Buka Multiplayer</button>
                    <div className="flex gap-3 mt-2">
                      <button onClick={() => { setCurrentPackage(pkg); setView('editor'); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"><Edit className="w-4 h-4" /> Edit</button>
                      <button onClick={async () => { if(window.confirm('Hapus paket ini selamanya?')) { await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'tts_packages', pkg.id)); setPackages(packages.filter(p => p.id !== pkg.id)); } }} className="bg-[#FECDD3] hover:bg-[#FDA4AF] text-[#BE123C] px-4 rounded-xl font-bold transition-all"><Trash2 className="w-5 h-5" /></button>
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
  const [inputMode, setInputMode] = useState('manual'); 
  const [bulkText, setBulkText] = useState('');
  
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(10);
  const [aiKey, setAiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [isGenerating, setIsGenerating] = useState(false);

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
    lines.forEach(line => {
      if (line.includes('-') || line.includes('=') || line.includes(':')) {
         const parts = line.split(/[-=:]/);
         const word = parts[0].trim().toUpperCase().replace(/[^A-Z]/g, '');
         const clue = parts.slice(1).join('-').trim();
         if (word.length >= 2 && clue.length > 0) newWordsList.push({ word, clue });
      }
    });
    if (newWordsList.length > 0) {
       setFormData(prev => ({ ...prev, words: [...prev.words, ...newWordsList] }));
       setBulkText('');
       alert(`Berhasil impor ${newWordsList.length} kata!`);
    }
  };

  // FIX: AUTO-FALLBACK AI GENERATOR
  const handleAIGenerate = async () => {
    if (!aiKey) return alert("Masukkan API Key Gemini terlebih dahulu!");
    if (!aiTopic) return alert("Topik soal tidak boleh kosong!");
    setIsGenerating(true);
    localStorage.setItem('gemini_api_key', aiKey);
    
    try {
      const prompt = `Buatkan ${aiCount} pasang kata dan petunjuk soal teka-teki silang (TTS) dengan topik "${aiTopic}". Syarat MUTLAK:
      1. Kata jawaban HANYA terdiri dari huruf A-Z, tanpa spasi, tanpa angka.
      2. Format setiap baris WAJIB persis seperti ini: JAWABAN - Petunjuk soal.
      3. Jangan ada penomoran, jangan ada teks pembuka/penutup. Langsung berikan daftar katanya saja.
      Contoh:
      MATAHARI - Pusat tata surya kita
      BUMI - Planet ketiga dari matahari`;
      
      const fetchWithModel = async (modelName) => {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${aiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        return await res.json();
      };

      // 1. Coba menggunakan model Flash terbaru
      let data = await fetchWithModel('gemini-1.5-flash');
      
      // 2. Fallback: Jika tidak didukung, otomatis coba pakai model lama yang paling stabil
      if (data.error && data.error.message.toLowerCase().includes('not found')) {
        data = await fetchWithModel('gemini-1.0-pro');
      }
      
      if (data.error) throw new Error(data.error.message);
      
      const text = data.candidates[0].content.parts[0].text;
      const lines = text.split('\n');
      const newWordsList = [];
      
      lines.forEach(line => {
        if (line.includes('-') || line.includes('=') || line.includes(':')) {
           const parts = line.split(/[-=:]/);
           const word = parts[0].trim().toUpperCase().replace(/[^A-Z]/g, '');
           const clue = parts.slice(1).join('-').trim();
           if (word.length >= 2 && clue.length > 0) newWordsList.push({ word, clue });
        }
      });
      
      if (newWordsList.length > 0) {
         setFormData(prev => ({ ...prev, words: [...prev.words, ...newWordsList] }));
         setAiTopic('');
         alert(`Magic! ${newWordsList.length} soal AI berhasil ditambahkan!`);
      } else {
         alert("Gagal memproses format dari AI. Coba klik Generate lagi.");
      }
    } catch (e) {
      alert("Error AI: " + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title) return alert("Nama Paket harus diisi!");
    if (formData.words.length < 2) return alert("Minimal masukkan 2 kata!");
    setSaving(true);
    try {
      const colRef = collection(db, 'artifacts', appId, 'users', user.uid, 'tts_packages');
      if (formData.id) await setDoc(doc(colRef, formData.id), formData);
      else { const newDocRef = doc(colRef); await setDoc(newDocRef, { ...formData, id: newDocRef.id }); }
      onSave();
    } catch (e) { alert("Gagal menyimpan."); } finally { setSaving(false); }
  };

  return (
    <div className="bg-white p-8 rounded-[2rem] shadow-sm border-4 border-[#FCE7F3]">
      <div className="flex items-center gap-4 mb-8 pb-4 border-b-2 border-dashed border-slate-100">
        <button onClick={onCancel} className="bg-slate-100 p-3 rounded-xl text-slate-500 font-bold hover:bg-slate-200"><ArrowLeft className="w-6 h-6"/></button>
        <h2 className="text-3xl font-black text-[#F472B6]">{formData.id ? 'Edit Paket' : 'Paket Baru'}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="space-y-5">
          <div><label className="block text-sm font-black text-slate-600 mb-2">Nama Paket</label><input type="text" className="w-full border-2 border-slate-200 bg-slate-50 rounded-xl p-3 font-bold focus:border-[#38BDF8] outline-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Cth: IPA Kelas 6" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-sm font-black text-slate-600 mb-2">Jenjang</label><select className="w-full border-2 border-slate-200 bg-slate-50 rounded-xl p-3 font-bold" value={formData.jenjang} onChange={e => setFormData({...formData, jenjang: e.target.value})}><option value="">Pilih</option><option value="SD">SD</option><option value="SMP">SMP</option><option value="SMA">SMA</option></select></div>
            <div><label className="block text-sm font-black text-slate-600 mb-2">Kelas</label><input type="text" className="w-full border-2 border-slate-200 bg-slate-50 rounded-xl p-3 font-bold" value={formData.kelas} onChange={e => setFormData({...formData, kelas: e.target.value})} placeholder="4, 5, 6" /></div>
            <div><label className="block text-sm font-black text-slate-600 mb-2">Papan</label><select className="w-full border-2 border-slate-200 bg-slate-50 rounded-xl p-3 font-bold" value={formData.gridSize} onChange={e => setFormData({...formData, gridSize: Number(e.target.value)})}><option value={10}>10x10</option><option value={15}>15x15</option><option value={20}>20x20</option></select></div>
          </div>
          <div><label className="block text-sm font-black text-slate-600 mb-2">Mata Pelajaran</label><input type="text" className="w-full border-2 border-slate-200 bg-slate-50 rounded-xl p-3 font-bold focus:border-[#38BDF8] outline-none" value={formData.mapel} onChange={e => setFormData({...formData, mapel: e.target.value})} placeholder="Cth: Ilmu Sains" /></div>
        </div>

        <div className="bg-[#F0FDF4] p-6 rounded-[2rem] border-4 border-[#BBF7D0]">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-black text-[#166534] text-xl">Daftar Kata</h3>
          </div>

          <div className="flex gap-2 mb-5 flex-wrap">
            <button onClick={() => setInputMode('manual')} className={`text-sm px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-sm transition ${inputMode === 'manual' ? 'bg-[#059669] text-white' : 'bg-white text-[#059669]'}`}><Edit className="w-4 h-4"/> Manual</button>
            <button onClick={() => setInputMode('bulk')} className={`text-sm px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-sm transition ${inputMode === 'bulk' ? 'bg-[#059669] text-white' : 'bg-white text-[#059669]'}`}><ClipboardType className="w-4 h-4"/> Paste</button>
            <button onClick={() => setInputMode('ai')} className={`text-sm px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-sm transition ${inputMode === 'ai' ? 'bg-[#7C3AED] text-white border-2 border-[#7C3AED]' : 'bg-purple-50 text-[#7C3AED] border-2 border-[#DDD6FE]'}`}><Wand2 className="w-4 h-4"/> Generate AI</button>
          </div>

          {inputMode === 'manual' && (
            <div className="flex flex-col gap-3 mb-6 animate-fade-in">
              <input type="text" placeholder="JAWABAN" className="border-2 border-slate-200 rounded-xl p-3 font-black uppercase text-lg" value={newWord} onChange={e => setNewWord(e.target.value)} />
              <div className="flex gap-2">
                <input type="text" placeholder="Petunjuk / Clue" className="border-2 border-slate-200 rounded-xl p-3 flex-grow font-semibold" value={newClue} onChange={e => setNewClue(e.target.value)} onKeyDown={e => e.key === 'Enter' && addWord()} />
                <button onClick={addWord} className="bg-[#38BDF8] text-white px-5 rounded-xl font-black shadow-[0_4px_0_0_#0284C7] active:translate-y-1 active:shadow-none"><Plus className="w-6 h-6"/></button>
              </div>
            </div>
          )}

          {inputMode === 'bulk' && (
            <div className="flex flex-col gap-3 mb-6 animate-fade-in">
              <p className="text-xs font-bold text-[#15803D]">Format: JAWABAN - Petunjuk</p>
              <textarea className="w-full border-2 border-[#86EFAC] rounded-xl p-3 h-32 font-medium outline-none focus:ring-2 focus:ring-[#22C55E]" placeholder="BUMI - Planet tempat kita tinggal" value={bulkText} onChange={e => setBulkText(e.target.value)}></textarea>
              <button onClick={handleBulkImport} className="bg-[#22C55E] text-white py-3 rounded-xl font-black shadow-[0_4px_0_0_#16A34A] active:translate-y-1 active:shadow-none">Proses Kata</button>
            </div>
          )}

          {inputMode === 'ai' && (
            <div className="flex flex-col gap-3 mb-6 bg-purple-50 p-4 rounded-2xl border-2 border-purple-200 animate-fade-in">
              <p className="text-xs font-bold text-purple-700 mb-1">Dapatkan API Key Gratis di Google AI Studio</p>
              <input type="password" placeholder="Gemini API Key" className="border-2 border-purple-200 rounded-xl p-3 font-semibold text-sm outline-none focus:border-purple-500" value={aiKey} onChange={e => setAiKey(e.target.value)} />
              <div className="flex gap-2 mt-2">
                <input type="text" placeholder="Topik (cth: Pahlawan Nasional)" className="border-2 border-purple-200 rounded-xl p-3 flex-grow font-semibold outline-none focus:border-purple-500" value={aiTopic} onChange={e => setAiTopic(e.target.value)} />
                <select className="border-2 border-purple-200 rounded-xl p-3 font-bold text-purple-700 outline-none" value={aiCount} onChange={e => setAiCount(Number(e.target.value))}>
                  <option value={5}>5 Kata</option>
                  <option value={10}>10 Kata</option>
                  <option value={15}>15 Kata</option>
                </select>
              </div>
              <button onClick={handleAIGenerate} disabled={isGenerating} className="mt-2 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-black shadow-[0_4px_0_0_#5B21B6] active:translate-y-1 active:shadow-none transition flex justify-center items-center gap-2">
                {isGenerating ? 'AI Sedang Berpikir...' : <><Wand2 className="w-5 h-5"/> Buat Otomatis</>}
              </button>
            </div>
          )}
          
          <div className="max-h-48 overflow-y-auto bg-white rounded-xl border-2 border-[#BBF7D0]">
            {formData.words.length === 0 ? <p className="text-[#166534] font-bold text-center py-6">Belum ada soal.</p> : (
              <ul className="divide-y-2 divide-slate-100">{formData.words.map((w, i) => (
                <li key={i} className="p-3 flex justify-between items-center text-sm">
                  <div><span className="font-black text-lg text-[#0369A1]">{w.word}</span> <span className="mx-2 text-slate-300">|</span> <span className="font-bold text-slate-600">{w.clue}</span></div>
                  <button onClick={() => setFormData(prev => ({...prev, words: prev.words.filter((_, idx) => idx !== i)}))} className="text-[#F43F5E] p-2 bg-[#FFE4E6] rounded-lg"><XCircle className="w-5 h-5"/></button>
                </li>
              ))}</ul>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex justify-end gap-4 pt-6 border-t-2 border-dashed border-slate-100">
        <button onClick={onCancel} className="px-8 py-4 rounded-2xl font-black text-slate-500 bg-slate-100">Batal</button>
        <button onClick={handleSave} disabled={saving} className="px-8 py-4 rounded-2xl font-black text-white bg-[#10B981] shadow-[0_5px_0_0_#059669] active:shadow-none active:translate-y-1 flex items-center gap-2">{saving ? 'Menyimpan...' : 'Simpan Paket Soal'}</button>
      </div>
    </div>
  );
}

// --- BOARD UI ---
function BoardUI({ gridSize, generatedData, revealedWords = [], onCellClick, interactive = false, activeWord = null, activeCell = null, userAnswers = {} }) {
  let grid = generatedData?.grid;
  if (!grid && generatedData?.gridString) {
    try { grid = JSON.parse(generatedData.gridString); } catch(e) { grid = []; }
  }
  const placedWords = generatedData?.placedWords || [];

  if (!grid || grid.length === 0) return <div className="text-center p-10 font-black text-slate-400">Papan gagal dibuat. Pastikan kata-katanya bisa bersilangan!</div>;

  return (
    <div className="w-full h-full flex items-center justify-center p-2 md:p-4 overflow-hidden">
      <div className="bg-[#4C1D95] border-4 border-[#2E1065] p-2 md:p-4 rounded-xl md:rounded-[2rem] shadow-[8px_8px_0px_0px_#2E1065]" 
           style={{ 
             display: 'grid', 
             gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
             gridTemplateRows: `repeat(${gridSize}, 1fr)`,
             width: 'min(100%, calc(100vh - 7rem))',
             height: 'min(100%, calc(100vh - 7rem))',
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
                className={`relative flex items-center justify-center font-black select-none transition-all duration-150 w-full h-full rounded-sm md:rounded-md
                  text-xs sm:text-base md:text-xl lg:text-2xl
                  ${isBlack ? 'bg-transparent' : 'bg-white border-[1px] md:border-[2px] border-slate-300 shadow-sm text-slate-800'} 
                  ${!isBlack && interactive ? 'cursor-pointer hover:bg-[#F0F9FF] hover:scale-110 hover:z-10' : ''}
                  ${isPartOfActiveWord && !isRevealed && !isCellActive ? 'bg-[#7DD3FC] border-[#0284C7]' : ''}
                  ${isCellActive ? 'bg-[#FDE047] border-[#EAB308] ring-2 md:ring-4 ring-[#FEF08A] z-20 scale-110 shadow-lg text-yellow-900' : ''}
                  ${isRevealed ? 'bg-[#86EFAC] text-[#14532D] border-[#16A34A]' : ''}
                `} 
                onClick={() => { if (!isBlack && interactive && onCellClick) onCellClick(x, y); }}
              >
                {!isBlack && startNumber && <span className={`absolute top-[1px] left-[2px] md:top-[2px] md:left-1 text-[7px] md:text-[10px] font-black ${isRevealed ? 'text-[#166534]' : 'text-slate-500'}`}>{startNumber}</span>}
                {!isBlack && <span className="uppercase animate-fade-in">{displayChar}</span>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// --- POP-UP PETUNJUK ---
function CluePopup({ activeWord, activeCell, setActiveWord, setActiveCell, checkCurrentWord, guess, handleType, isMuted }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [rel, setRel] = useState({ x: 0, y: 0 });

  useEffect(() => { setPos({ x: 0, y: 0 }); }, [activeWord]);

  if (!activeWord) return null;

  const onMouseDown = (e) => {
    setIsDragging(true);
    setRel({ x: e.pageX - pos.x, y: e.pageY - pos.y });
    e.stopPropagation(); e.preventDefault();
  };
  const onMouseUp = () => setIsDragging(false);
  const onMouseMove = (e) => {
    if (!isDragging) return;
    setPos({ x: e.pageX - rel.x, y: e.pageY - rel.y });
    e.stopPropagation(); e.preventDefault();
  };

  const onTouchStart = (e) => {
    setIsDragging(true);
    setRel({ x: e.touches[0].pageX - pos.x, y: e.touches[0].pageY - pos.y });
  };
  const onTouchMove = (e) => {
    if (!isDragging) return;
    setPos({ x: e.touches[0].pageX - rel.x, y: e.touches[0].pageY - rel.y });
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onMouseUp);
    } else {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onMouseUp);
    };
  }, [isDragging, rel]);

  return (
    <div 
      className={`fixed z-[60] w-[95%] max-w-md bg-[#38BDF8] border-4 border-[#0284C7] p-4 md:p-5 rounded-[2rem] shadow-[0_10px_40px_rgb(0,0,0,0.6)] flex flex-col gap-3 ${!isDragging && 'animate-fade-in'}`}
      style={{ left: '50%', bottom: '80px', transform: `translate(calc(-50% + ${pos.x}px), ${pos.y}px)`, cursor: isDragging ? 'grabbing' : 'grab' }}
      onMouseDown={onMouseDown} onTouchStart={onTouchStart}
    >
      <div className="flex justify-between items-center pb-2">
        <span className="text-[10px] md:text-sm font-black bg-[#FEF08A] text-[#854D0E] px-3 md:px-4 py-1.5 rounded-xl shadow-sm select-none pointer-events-none">{activeWord.isHorizontal ? 'MENDATAR' : 'MENURUN'} - {activeWord.number}</span>
        <div className="flex-1 flex justify-center pointer-events-none"><div className="w-12 md:w-16 h-2 bg-white/40 rounded-full"></div></div>
        <button onMouseDown={(e)=>e.stopPropagation()} onTouchStart={(e)=>e.stopPropagation()} onClick={() => {setActiveWord(null); setActiveCell(null);}} className="bg-white/20 p-1.5 md:p-2 rounded-xl hover:bg-white/40 transition z-10"><XCircle className="w-5 h-5 md:w-6 md:h-6 text-white"/></button>
      </div>
      <p className="text-base md:text-2xl font-black text-white leading-tight drop-shadow-md mb-2 select-none" onMouseDown={(e)=>e.stopPropagation()} onTouchStart={(e)=>e.stopPropagation()}>{activeWord.clue}</p>
      <form onSubmit={(e) => { e.preventDefault(); checkCurrentWord(); }} className="flex gap-2" onMouseDown={(e)=>e.stopPropagation()} onTouchStart={(e)=>e.stopPropagation()}>
        <input autoFocus type="text" placeholder={`${activeWord.word.length} HURUF`} className="flex-grow border-4 border-white/50 bg-white rounded-2xl p-3 md:p-4 text-center text-lg md:text-xl font-black uppercase tracking-widest focus:border-white outline-none text-[#0369A1] shadow-inner" value={guess} onChange={handleType} maxLength={activeWord.word.length} />
        <button type="submit" className="bg-[#A7F3D0] text-[#065F46] px-4 md:px-6 rounded-2xl font-black text-sm md:text-lg shadow-[0_4px_0_0_#059669] active:translate-y-1 active:shadow-none transition">CEK</button>
      </form>
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
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [bgm] = useState(() => new Audio(SOUNDS.bgm));
  const [toast, setToast] = useState(null);
  const [hasWon, setHasWon] = useState(false);

  const showToast = (msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    bgm.loop = true;
    bgm.volume = 0.15; 
    if (!isMuted) bgm.play().catch(() => {});
    else bgm.pause();
    return () => { bgm.pause(); };
  }, [isMuted, bgm]);

  useEffect(() => { setGeneratedData(generateCrossword(gamePackage.words, gamePackage.gridSize)); }, [gamePackage]);

  const isComplete = generatedData?.placedWords?.length > 0 && revealedWords.length === generatedData.placedWords.length;

  useEffect(() => {
    if (isComplete && !hasWon) {
      setHasWon(true);
      playSFX('win', isMuted);
    }
  }, [isComplete, hasWon, isMuted]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!activeCell || !activeWord) return;
      const key = e.key.toUpperCase();

      if (/^[A-Z]$/.test(key) && key.length === 1) {
        playSFX('type', isMuted);
        setUserAnswers(prev => ({ ...prev, [`${activeCell.x}-${activeCell.y}`]: key }));
        if (activeWord.isHorizontal && activeCell.x < activeWord.x + activeWord.word.length - 1) setActiveCell({ x: activeCell.x + 1, y: activeCell.y });
        else if (!activeWord.isHorizontal && activeCell.y < activeWord.y + activeWord.word.length - 1) setActiveCell({ x: activeCell.x, y: activeCell.y + 1 });
      } else if (e.key === 'Backspace') {
        playSFX('type', isMuted);
        setUserAnswers(prev => { const next = { ...prev }; delete next[`${activeCell.x}-${activeCell.y}`]; return next; });
        if (activeWord.isHorizontal && activeCell.x > activeWord.x) setActiveCell({ x: activeCell.x - 1, y: activeCell.y });
        else if (!activeWord.isHorizontal && activeCell.y > activeWord.y) setActiveCell({ x: activeCell.x, y: activeCell.y - 1 });
      } else if (e.key === 'Enter') checkCurrentWord();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCell, activeWord, userAnswers]);

  const handleCellClick = (x, y) => {
    const { placedWords } = generatedData;
    const covering = placedWords.filter(w => (w.isHorizontal && w.y === y && x >= w.x && x < w.x + w.word.length) || (!w.isHorizontal && w.x === x && y >= w.y && y < w.y + w.word.length));
    if (covering.length === 0) return;
    if (activeWord && covering.some(w => w.word === activeWord.word)) {
      if (covering.length > 1) setActiveWord(covering.find(w => w.word !== activeWord.word));
    } else setActiveWord(covering[0]);
    setActiveCell({ x, y });
  };

  const checkCurrentWord = () => {
    if (!activeWord) return;
    let currentGuess = '';
    for (let i = 0; i < activeWord.word.length; i++) {
      const cx = activeWord.isHorizontal ? activeWord.x + i : activeWord.x;
      const cy = activeWord.isHorizontal ? activeWord.y : activeWord.y + i;
      currentGuess += (userAnswers[`${cx}-${cy}`] || ' ');
    }
    if (currentGuess.trim().length < activeWord.word.length) return showToast("Lengkapi kotaknya!", "error");
    if (currentGuess === activeWord.word) {
      playSFX('correct', isMuted);
      if (!revealedWords.includes(activeWord.word)) setRevealedWords([...revealedWords, activeWord.word]);
      setActiveWord(null); setActiveCell(null);
    } else {
      playSFX('wrong', isMuted);
      showToast("Ops, salah. Coba lagi!", "error");
    }
  };

  const handleType = (e) => {
    playSFX('type', isMuted);
    let val = e.target.value.toUpperCase();
    let idx = 0;
    const nextAnswers = { ...userAnswers };
    for (let i = 0; i < activeWord.word.length; i++) {
      const cx = activeWord.isHorizontal ? activeWord.x + i : activeWord.x;
      const cy = activeWord.isHorizontal ? activeWord.y : activeWord.y + i;
      if (idx < val.length) nextAnswers[`${cx}-${cy}`] = val[idx++];
      else delete nextAnswers[`${cx}-${cy}`];
    }
    setUserAnswers(nextAnswers);
  }

  const getCurrentGuessString = () => {
    if(!activeWord) return '';
    let str = '';
    for (let i = 0; i < activeWord.word.length; i++) {
      const cx = activeWord.isHorizontal ? activeWord.x + i : activeWord.x;
      const cy = activeWord.isHorizontal ? activeWord.y : activeWord.y + i;
      str += (userAnswers[`${cx}-${cy}`] || '');
    }
    return str;
  }

  if (!generatedData) return <div className="flex h-screen items-center justify-center font-black text-2xl text-[#F472B6] animate-pulse">Menyiapkan Papan Ajaib...</div>;

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-[#1E293B] p-2 flex flex-col" : "flex flex-col h-[88vh]"}>
      <Toast toast={toast} />
      
      <div className="flex-grow flex flex-col lg:flex-row gap-3 overflow-hidden relative mb-2 md:mb-3">
        <div className={`flex-1 flex items-center justify-center relative shadow-inner overflow-hidden rounded-[2rem] ${isFullscreen ? 'bg-transparent' : 'bg-white border-4 border-[#FCE7F3]'}`}>
          {isComplete && <div className="absolute inset-0 bg-white/90 z-30 flex flex-col items-center justify-center backdrop-blur-md animate-fade-in"><Trophy className="w-32 h-32 text-yellow-400 mb-6 drop-shadow-lg" /><h2 className="text-5xl font-black text-[#F472B6] tracking-tight">KAMU HEBAT!</h2></div>}
          <BoardUI gridSize={gamePackage.gridSize} generatedData={generatedData} revealedWords={revealedWords} activeWord={activeWord} activeCell={activeCell} userAnswers={userAnswers} onCellClick={handleCellClick} interactive={true} />
        </div>
        
        {!isFullscreen && (
          <div className="w-full lg:w-[300px] shrink-0 bg-white rounded-[2rem] border-4 border-[#E0F2FE] flex flex-col overflow-hidden shadow-sm hidden md:flex">
            {activeWord ? (
              <div className="p-4 bg-[#38BDF8] text-white border-b-4 border-[#0284C7] shadow-md z-10 animate-fade-in">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black bg-[#FEF08A] text-[#854D0E] px-2 py-1 rounded-lg shadow-sm">{activeWord.isHorizontal ? 'MENDATAR' : 'MENURUN'} - {activeWord.number}</span>
                  <button onClick={() => {setActiveWord(null); setActiveCell(null);}} className="bg-white/20 p-1 rounded-lg hover:bg-white/40"><XCircle className="w-4 h-4"/></button>
                </div>
                <p className="text-sm font-black mb-3 leading-tight drop-shadow-md">{activeWord.clue}</p>
                <button onClick={checkCurrentWord} className="w-full bg-[#A7F3D0] text-[#065F46] py-2 rounded-xl font-black text-xs shadow-[0_3px_0_0_#059669] active:translate-y-1 active:shadow-none">CEK JAWABAN</button>
              </div>
            ) : <div className="p-4 bg-slate-50 border-b-4 border-slate-200 text-center flex flex-col items-center justify-center"><div className="w-8 h-8 bg-[#FBCFE8] rounded-full flex items-center justify-center mb-2 shadow-sm"><Play className="w-4 h-4 text-[#F472B6]"/></div><p className="text-slate-500 font-bold text-xs">Klik kotak di papan.</p></div>}
            
            <div className="flex-grow overflow-y-auto p-3 flex flex-col gap-4 bg-white custom-scrollbar">
              {['Mendatar', 'Menurun'].map((dir, i) => (
                <div key={dir}>
                  <h3 className="font-black text-[#94A3B8] mb-2 border-b-2 border-slate-100 pb-1 text-xs uppercase">{dir}</h3>
                  <ul className="space-y-2">
                    {generatedData.placedWords.filter(w => (i === 0 ? w.isHorizontal : !w.isHorizontal)).sort((a,b) => a.number - b.number).map(w => {
                      const isRevealed = revealedWords.includes(w.word);
                      const isActive = activeWord?.word === w.word;
                      return (
                      <li key={w.number} onClick={() => {setActiveWord(w); setActiveCell({x: w.x, y: w.y});}} className={`p-2 rounded-xl cursor-pointer transition-all duration-200 border-2 md:border-4 ${isRevealed ? 'border-[#BBF7D0] bg-[#F0FDF4] opacity-60' : isActive ? 'border-[#38BDF8] bg-[#E0F2FE] scale-[1.02] shadow-sm' : 'border-slate-100 bg-white hover:border-[#BAE6FD]'}`}>
                        <span className={`font-black text-xs mr-1 ${isActive ? 'text-[#0284C7]' : 'text-slate-400'}`}>{w.number}.</span> 
                        {isRevealed ? <span className="font-black tracking-widest text-[#16A34A] uppercase text-xs">{w.word}</span> : <span className="font-bold text-slate-600 text-xs">{w.clue}</span>}
                      </li>
                    )})}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={`flex justify-between items-center shrink-0 ${isFullscreen ? 'bg-[#0F172A]' : 'bg-white border-2 md:border-4 border-[#E0F2FE]'} p-2 md:px-4 rounded-xl md:rounded-2xl shadow-sm transition-colors`}>
        <button onClick={isFullscreen ? () => setIsFullscreen(false) : onBack} className={`p-1.5 md:p-2 rounded-lg font-bold transition-all ${isFullscreen ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}><ArrowLeft className="w-4 h-4 md:w-5 md:h-5"/></button>
        <div className={`text-center font-black text-sm md:text-lg drop-shadow-sm ${isFullscreen ? 'text-[#38BDF8]' : 'text-[#38BDF8]'}`}>MODE SOLO</div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <button onClick={() => setIsMuted(!isMuted)} className={`p-1.5 md:p-2 rounded-lg transition-all ${isFullscreen ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
            {isMuted ? <VolumeX className="w-4 h-4 md:w-5 md:h-5"/> : <Volume2 className="w-4 h-4 md:w-5 md:h-5"/>}
          </button>
          <button onClick={() => setIsFullscreen(!isFullscreen)} className={`p-1.5 md:p-2 rounded-lg transition-all ${isFullscreen ? 'bg-sky-500 text-white shadow-[0_2px_0_0_#0284C7]' : 'bg-[#BAE6FD] text-[#0369A1] shadow-[0_2px_0_0_#38BDF8]'}`}>
            {isFullscreen ? <Minimize className="w-4 h-4 md:w-5 md:h-5"/> : <Maximize className="w-4 h-4 md:w-5 md:h-5"/>}
          </button>
          <button onClick={() => setRevealedWords(generatedData.placedWords.map(w => w.word))} className="bg-[#FEF08A] text-[#854D0E] px-2 py-1 md:px-3 md:py-1.5 rounded-lg font-black shadow-[0_2px_0_0_#EAB308] active:translate-y-1 active:shadow-none text-xs md:text-sm ml-1 hidden sm:block">Buka Semua</button>
        </div>
      </div>

      {(!isFullscreen ? false : true) && activeWord && (
        <CluePopup activeWord={activeWord} activeCell={activeCell} setActiveWord={setActiveWord} setActiveCell={setActiveCell} checkCurrentWord={checkCurrentWord} guess={getCurrentGuessString()} handleType={handleType} isMuted={isMuted} />
      )}
    </div>
  );
}

// --- MULTIPLAYER COMPONENTS ---
function HostLobby({ gamePackage, user, db, onStart, onCancel }) {
  const [pin] = useState(Math.floor(100000 + Math.random() * 900000).toString());
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      const genData = generateCrossword(gamePackage.words, gamePackage.gridSize);
      const data = { 
        pin, hostId: user.uid, status: 'playing', title: gamePackage.title, 
        gridSize: gamePackage.gridSize, 
        generatedData: { placedWords: genData.placedWords, gridString: JSON.stringify(genData.grid) },
        revealedWords: [], teams: {}, createdAt: new Date().toISOString() 
      };
      await setDoc(doc(db, 'tts_sessions', pin), data);
      onStart(pin, data);
    } catch (error) { alert("Gagal membuat ruangan."); setStarting(false); }
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-10 rounded-[2rem] shadow-sm text-center mt-16 border-4 border-[#FCE7F3]">
      <h2 className="text-4xl font-black text-[#F472B6] mb-3">Multiplayer Live</h2>
      <p className="text-slate-500 font-bold mb-10 text-lg">Minta siswa masuk menggunakan PIN ini.</p>
      <div className="bg-[#E0F2FE] border-4 border-[#BAE6FD] p-10 rounded-[2rem] mb-10 shadow-inner">
        <p className="text-sm font-black text-[#0284C7] mb-3 uppercase tracking-widest">PIN Ruangan</p>
        <p className="text-7xl font-black text-[#0369A1] tracking-widest drop-shadow-md">{pin}</p>
      </div>
      <div className="flex gap-4">
        <button onClick={onCancel} className="flex-1 py-5 font-black text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-2xl text-xl">Batal</button>
        <button onClick={handleStart} disabled={starting} className="flex-1 py-5 font-black text-white bg-[#34D399] hover:bg-[#10B981] rounded-2xl text-xl shadow-[0_6px_0_0_#059669] active:translate-y-1 active:shadow-none">Buka Ruangan</button>
      </div>
    </div>
  );
}

function HostPlay({ sessionPin, db, onEnd }) {
  const [sessionData, setSessionData] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [bgm] = useState(() => new Audio(SOUNDS.bgm));
  const [hasWon, setHasWon] = useState(false);

  useEffect(() => {
    bgm.loop = true;
    bgm.volume = 0.15; 
    if (!isMuted) bgm.play().catch(() => {});
    else bgm.pause();
    return () => { bgm.pause(); };
  }, [isMuted, bgm]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'tts_sessions', sessionPin), (snap) => {
      if (snap.exists()) setSessionData(snap.data());
    });
    return () => unsubscribe();
  }, [sessionPin, db]);

  const placedWordsCount = sessionData?.generatedData?.placedWords?.length || 0;
  const revealedWordsCount = sessionData?.revealedWords?.length || 0;
  const isComplete = placedWordsCount > 0 && revealedWordsCount === placedWordsCount;

  useEffect(() => {
    if (isComplete && !hasWon) {
      setHasWon(true);
      playSFX('win', isMuted);
    }
  }, [isComplete, hasWon, isMuted]);

  if (!sessionData) return <div className="text-center mt-20 text-3xl font-black text-[#F472B6] animate-pulse">Menyiapkan Arena...</div>;
  
  const teams = Object.entries(sessionData.teams || {}).map(([name, d]) => ({ name, ...d })).sort((a,b) => b.score - a.score);

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-[#1E293B] p-2 flex flex-col" : "flex flex-col h-[88vh]"}>
      <div className="flex-grow flex flex-col lg:flex-row gap-3 overflow-hidden mb-2 md:mb-3">
        <div className={`flex-1 flex items-center justify-center overflow-hidden relative shadow-inner rounded-[2rem] ${isFullscreen ? 'bg-transparent' : 'bg-white border-4 border-[#FCE7F3]'}`}>
          {isComplete && (
            <div className="absolute inset-0 bg-white/90 z-30 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in">
              <Trophy className="w-32 h-32 md:w-40 md:h-40 text-yellow-400 mb-6 drop-shadow-xl" />
              <h2 className="text-4xl md:text-6xl font-black text-[#F472B6] tracking-widest">SELESAI!</h2>
              {teams.length > 0 && (
                <div className="mt-8 text-center bg-[#FEF08A] p-6 md:p-8 rounded-[2rem] border-4 border-[#EAB308] shadow-lg">
                  <p className="text-xl md:text-2xl font-bold text-[#854D0E] mb-2">Juara 1</p>
                  <p className="text-3xl md:text-5xl font-black text-[#713F12]">{teams[0].name} <span className="text-xl md:text-3xl">({teams[0].score} Poin)</span></p>
                </div>
              )}
            </div>
          )}
          <BoardUI gridSize={sessionData?.gridSize} generatedData={sessionData?.generatedData} revealedWords={sessionData?.revealedWords || []} interactive={false} />
        </div>
        
        {!isFullscreen && (
          <div className="w-full lg:w-[300px] shrink-0 bg-white rounded-[2rem] border-4 border-[#BBF7D0] flex flex-col overflow-hidden shadow-sm hidden md:flex">
            <div className="bg-[#34D399] text-white p-3 text-center border-b-4 border-[#10B981]">
              <h3 className="font-black text-lg flex items-center justify-center gap-2"><Trophy className="w-5 h-5"/> Klasemen</h3>
            </div>
            <div className="flex-grow overflow-y-auto p-3 bg-[#F0FDF4] custom-scrollbar">
              {teams.length === 0 ? <p className="text-center text-[#059669] mt-10 font-bold text-xs">Menunggu siswa...</p> : (
                <ul className="space-y-2">
                  {teams.map((t, i) => (
                    <li key={t.name} className="bg-white p-2 rounded-xl shadow-sm border-2 md:border-4 border-[#D1FAE5] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs ${i === 0 ? 'bg-[#FEF08A] text-[#854D0E]' : 'bg-slate-100 text-slate-500'}`}>{i+1}</span>
                        <span className="font-black text-xs md:text-sm text-slate-700 truncate max-w-[100px]">{t.name}</span>
                      </div>
                      <span className="font-black text-sm md:text-lg text-[#059669]">{t.score}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      <div className={`flex justify-between items-center shrink-0 ${isFullscreen ? 'bg-[#0F172A]' : 'bg-white border-2 md:border-4 border-[#E0F2FE]'} p-2 md:px-4 rounded-xl md:rounded-2xl shadow-sm transition-colors`}>
        <div className="flex items-center gap-1.5 md:gap-3">
          <h2 className={`text-sm md:text-lg font-black ${isFullscreen ? 'text-white' : 'text-slate-800'}`}>{sessionData.title} <span className="bg-[#F43F5E] text-white text-[9px] md:text-[10px] px-2 py-0.5 rounded-lg ml-1 animate-pulse">LIVE</span></h2>
          <p className={`font-bold text-xs md:text-sm ml-1 md:ml-3 ${isFullscreen ? 'text-slate-400' : 'text-slate-500'}`}>PIN: <span className="font-black text-[#38BDF8] text-sm md:text-base ml-1">{sessionPin}</span></p>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <button onClick={() => setIsMuted(!isMuted)} className={`p-1.5 md:p-2 rounded-lg transition-all ${isFullscreen ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
            {isMuted ? <VolumeX className="w-4 h-4 md:w-5 md:h-5"/> : <Volume2 className="w-4 h-4 md:w-5 md:h-5"/>}
          </button>
          <button onClick={() => setIsFullscreen(!isFullscreen)} className={`p-1.5 md:p-2 rounded-lg transition-all ${isFullscreen ? 'bg-sky-500 text-white shadow-[0_2px_0_0_#0284C7]' : 'bg-[#BAE6FD] text-[#0369A1] shadow-[0_2px_0_0_#38BDF8]'}`}>
            {isFullscreen ? <Minimize className="w-4 h-4 md:w-5 md:h-5"/> : <Maximize className="w-4 h-4 md:w-5 md:h-5"/>}
          </button>
          <button onClick={async () => { if(window.confirm('Tutup ruangan?')) { await deleteDoc(doc(db, 'tts_sessions', sessionPin)); onEnd(); } }} className="bg-[#FECDD3] text-[#BE123C] px-3 md:px-4 py-1.5 md:py-2 rounded-lg font-black text-xs md:text-sm shadow-[0_2px_0_0_#F43F5E] active:translate-y-1 active:shadow-none hidden md:block">Tutup Room</button>
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
        if (!currentTeams[teamName]) { currentTeams[teamName] = { score: 0 }; await updateDoc(ref, { teams: currentTeams }); }
        onJoin({ ...data, teams: currentTeams }, teamName);
      } else alert("PIN tidak valid.");
    } catch (error) { alert("Gagal bergabung."); } finally { setJoining(false); }
  };

  return (
    <div className="max-w-md mx-auto mt-20 bg-white p-10 rounded-[2rem] shadow-sm border-4 border-[#BAE6FD]">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-black text-[#0284C7] tracking-tight">Masuk Game</h2>
        <p className="text-slate-500 font-bold mt-2 text-lg">Minta PIN pada Guru Anda</p>
      </div>
      <form onSubmit={handleJoin} className="space-y-6">
        <div><input type="text" placeholder="PIN Ruangan" className="w-full text-center text-4xl font-black tracking-widest border-4 border-[#E0F2FE] bg-[#F0F9FF] rounded-2xl p-4 focus:border-[#38BDF8] outline-none text-[#0369A1]" value={pin} onChange={e=>setPin(e.target.value)} required /></div>
        <div><input type="text" placeholder="Nama Kamu / Kelompok" className="w-full border-4 border-slate-100 rounded-2xl p-4 font-bold text-xl focus:border-[#38BDF8] outline-none" value={teamName} onChange={e=>setTeamName(e.target.value)} required /></div>
        <button type="submit" disabled={joining} className="w-full bg-[#38BDF8] text-white font-black text-2xl p-5 rounded-2xl shadow-[0_6px_0_0_#0284C7] active:translate-y-1 active:shadow-none mt-4">{joining ? 'Masuk...' : 'GAS MAIN!'}</button>
        <button type="button" onClick={onBack} className="w-full text-slate-400 font-bold text-lg hover:text-slate-600">Kembali</button>
      </form>
    </div>
  );
}

function PlayerPlay({ sessionData, teamName, db, onLeave }) {
  const [localData, setLocalData] = useState(sessionData);
  const [activeQ, setActiveQ] = useState(null);
  const [guess, setGuess] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [bgm] = useState(() => new Audio(SOUNDS.bgm));
  const [toast, setToast] = useState(null);
  const [hasWon, setHasWon] = useState(false);

  const showToast = (msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    bgm.loop = true;
    bgm.volume = 0.15; 
    if (!isMuted) bgm.play().catch(() => {});
    else bgm.pause();
    return () => { bgm.pause(); };
  }, [isMuted, bgm]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'tts_sessions', localData?.pin || ''), (snap) => {
      if (snap.exists()) setLocalData(snap.data()); 
      else { 
        alert("Sesi permainan ini telah ditutup oleh Guru."); 
        onLeave(); 
      }
    });
    return () => unsubscribe();
  }, [localData?.pin, db, onLeave]);

  const placedWords = localData?.generatedData?.placedWords || [];
  const revealedWords = localData?.revealedWords || [];
  const isComplete = placedWords.length > 0 && revealedWords.length === placedWords.length;

  useEffect(() => {
    if (isComplete && !hasWon) {
      setHasWon(true);
      playSFX('win', isMuted);
    }
  }, [isComplete, hasWon, isMuted]);

  const handleSubmit = async () => {
    const answer = guess.trim().toUpperCase();
    if (answer.length < activeQ.word.length) {
       return showToast("Lengkapi kotaknya!", "error");
    }

    if (answer === activeQ.word) {
      try {
        const ref = doc(db, 'tts_sessions', localData.pin);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const currentData = snap.data();
          if (!(currentData.revealedWords || []).includes(activeQ.word)) {
             const newTeams = { ...(currentData.teams || {}) };
             if (!newTeams[teamName]) newTeams[teamName] = { score: 0 };
             newTeams[teamName].score += 10;
             await updateDoc(ref, { revealedWords: [...(currentData.revealedWords || []), activeQ.word], teams: newTeams });
             playSFX('correct', isMuted);
             showToast('BENAR! +10 Poin', 'success');
          } else {
             playSFX('wrong', isMuted);
             showToast('Keduluan tim lain!', 'error');
          }
        }
      } catch (err) {}
      setTimeout(() => { setActiveQ(null); setGuess(''); }, 1500);
    } else { 
      playSFX('wrong', isMuted);
      showToast('Ops, salah. Coba lagi!', 'error'); 
    }
  };

  const handleType = (e) => {
    playSFX('type', isMuted);
    setGuess(e.target.value.toUpperCase());
  }

  const myScore = localData?.teams?.[teamName]?.score || 0;

  if (isComplete) return (
    <div className="max-w-md mx-auto mt-20 bg-white p-10 rounded-[2rem] shadow-sm text-center border-4 border-[#FCE7F3]">
      <Trophy className="w-32 h-32 text-yellow-400 mx-auto mb-6" />
      <h2 className="text-4xl font-black text-[#F472B6]">Selesai!</h2>
      <p className="text-2xl font-bold mt-6 text-slate-600">Skor Akhir:</p>
      <p className="text-7xl font-black text-[#0369A1] mt-4">{myScore}</p>
      <button onClick={onLeave} className="mt-10 bg-slate-100 hover:bg-slate-200 transition w-full p-4 rounded-2xl font-black text-xl text-slate-500">Keluar</button>
    </div>
  );

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-[#1E293B] p-2 flex flex-col" : "flex flex-col h-[88vh]"}>
      <Toast toast={toast} />
      
      <div className="flex-grow flex flex-col lg:flex-row gap-3 overflow-hidden relative mb-2 md:mb-3">
        <div className={`flex-1 flex items-center justify-center relative shadow-inner overflow-hidden rounded-[2rem] ${isFullscreen ? 'bg-transparent' : 'bg-white border-4 border-[#FCE7F3]'}`}>
          <BoardUI gridSize={localData?.gridSize} generatedData={localData?.generatedData} revealedWords={revealedWords} activeWord={activeQ} activeCell={null} userAnswers={{}} onCellClick={(x,y) => {
            const covering = placedWords.filter(w => (w.isHorizontal && w.y === y && x >= w.x && x < w.x + w.word.length) || (!w.isHorizontal && w.x === x && y >= w.y && y < w.y + w.word.length));
            if (covering.length > 0 && !revealedWords.includes(covering[0].word)) { playSFX('type', isMuted); setActiveQ(covering[0]); }
          }} interactive={true} />
        </div>

        {!isFullscreen && (
          <div className="w-full lg:w-[300px] shrink-0 bg-white rounded-[2rem] border-4 border-[#E0F2FE] flex flex-col overflow-hidden shadow-sm hidden md:flex">
            {activeQ ? (
              <div className="p-4 bg-white border-b-4 border-slate-100 shadow-sm z-10 animate-fade-in relative">
                <div className="flex justify-between items-center mb-4 mt-2">
                  <span className="text-xs font-black bg-[#FEF08A] text-[#854D0E] px-4 py-2 rounded-xl">{activeQ.isHorizontal?'MENDATAR':'MENURUN'} {activeQ.number}</span>
                  <button onClick={()=>{setActiveQ(null);}} className="text-slate-300 hover:text-slate-500"><XCircle className="w-7 h-7"/></button>
                </div>
                <p className="text-xl font-black mb-6 text-slate-800 leading-tight">{activeQ.clue}</p>
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                  <input autoFocus type="text" placeholder={`${activeQ.word.length} HURUF`} className="w-full border-4 border-slate-100 bg-slate-50 rounded-2xl p-4 text-center text-2xl font-black uppercase tracking-widest focus:border-[#38BDF8] outline-none mb-4 text-[#0369A1]" value={guess} onChange={handleType} maxLength={activeQ.word.length} />
                  <button type="submit" className="w-full bg-[#34D399] text-white p-4 rounded-2xl font-black text-xl shadow-[0_5px_0_0_#059669] active:translate-y-1 active:shadow-none">JAWAB</button>
                </form>
              </div>
            ) : <div className="p-6 bg-slate-50 border-b-4 border-slate-200 text-center flex flex-col items-center justify-center"><div className="w-12 h-12 bg-[#FBCFE8] rounded-[1.5rem] flex items-center justify-center mb-3 shadow-sm"><Play className="w-6 h-6 text-[#F472B6]"/></div><p className="text-slate-500 font-bold text-sm">Klik kotak di papan untuk menjawab.</p></div>}
            
            <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-6 bg-white custom-scrollbar">
              {['Mendatar', 'Menurun'].map((dir, i) => (
                <div key={dir}>
                  <h3 className="font-black text-[#94A3B8] mb-3 border-b-4 border-slate-100 pb-1 text-sm uppercase">{dir}</h3>
                  <ul className="space-y-2">
                    {placedWords.filter(w => (i === 0 ? w.isHorizontal : !w.isHorizontal)).sort((a,b) => a.number - b.number).map(w => {
                      const isAnswered = revealedWords.includes(w.word);
                      const isActive = activeQ?.word === w.word;
                      return (
                      <li key={w.number} onClick={() => { if(!isAnswered){ playSFX('type', isMuted); setActiveQ(w); setGuess(''); } }} className={`p-3 rounded-xl cursor-pointer transition-all duration-200 border-4 ${isAnswered ? 'border-[#BBF7D0] bg-[#F0FDF4] opacity-60' : isActive ? 'border-[#38BDF8] bg-[#E0F2FE] scale-[1.02] shadow-md' : 'border-slate-100 bg-white hover:border-[#BAE6FD]'}`}>
                        <span className={`font-black text-sm mr-2 ${isActive ? 'text-[#0284C7]' : 'text-slate-400'}`}>{w.number}.</span> 
                        {isRevealed ? <span className="font-black tracking-widest text-[#16A34A] uppercase text-sm">{w.word}</span> : <span className="font-bold text-slate-600 text-sm">{w.clue}</span>}
                      </li>
                    )})}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={`flex justify-between items-center shrink-0 ${isFullscreen ? 'bg-[#0F172A]' : 'bg-[#38BDF8] border-2 md:border-4 border-[#7DD3FC]'} text-white rounded-xl md:rounded-2xl shadow-[0_3px_0_0_#0284C7] p-2 md:p-3 transition-colors`}>
        <div className="flex items-center gap-2">
          <p className={`text-[9px] md:text-[10px] font-black uppercase tracking-wider ${isFullscreen ? 'text-slate-400' : 'text-[#BAE6FD]'}`}>Tim:</p>
          <h2 className="text-sm md:text-lg font-black">{teamName}</h2>
        </div>
        <div className="flex items-center gap-1.5 md:gap-3">
          <div className="text-right flex items-center gap-1.5 md:gap-2 mr-2">
            <p className={`text-[9px] md:text-[10px] font-black uppercase tracking-wider ${isFullscreen ? 'text-slate-400' : 'text-[#BAE6FD]'}`}>Skor:</p>
            <p className="text-lg md:text-2xl font-black">{myScore}</p>
          </div>
          <button onClick={() => setIsMuted(!isMuted)} className={`p-1.5 md:p-2 rounded-lg transition ${isFullscreen ? 'bg-slate-700 hover:bg-slate-600' : 'bg-white/20 hover:bg-white/40'}`}>
            {isMuted ? <VolumeX className="w-4 h-4 md:w-5 md:h-5"/> : <Volume2 className="w-4 h-4 md:w-5 md:h-5"/>}
          </button>
          <button onClick={() => setIsFullscreen(!isFullscreen)} className={`p-1.5 md:p-2 rounded-lg transition ${isFullscreen ? 'bg-sky-500 text-white shadow-[0_2px_0_0_#0284C7]' : 'bg-white text-[#0369A1] shadow-[0_2px_0_0_#BAE6FD]'}`}>
            {isFullscreen ? <Minimize className="w-4 h-4 md:w-5 md:h-5"/> : <Maximize className="w-4 h-4 md:w-5 md:h-5"/>}
          </button>
        </div>
      </div>

      {activeQ && (
        <div className={!isFullscreen ? 'md:hidden' : ''}>
          <CluePopup activeWord={activeQ} activeCell={null} setActiveWord={setActiveQ} setActiveCell={()=>{}} checkCurrentWord={handleSubmit} guess={guess} handleType={handleType} isMuted={isMuted} />
        </div>
      )}
    </div>
  );
}
