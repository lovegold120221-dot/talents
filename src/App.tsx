import { useEffect, useState, useRef } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { AudioRecorder, AudioStreamer } from './lib/audio';
import { 
  Square, Loader2, LogOut, Check, Settings, X, Save, 
  Video, MessageSquare, Mic, Camera, Plus, Phone, Mail, 
  FileText, Car, EllipsisVertical, PhoneOff, Trash2,
  Calendar, ListTodo, Search, MapPin
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { KaraokeTranscript } from './components/KaraokeTranscript';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: any;
}

interface ActionTask {
  id: string;
  serviceName: string;
  action: string;
  status: 'processing' | 'completed';
}

const VOICE_ALIASES = [
  { name: "Beatrice", id: "Aoede" },
  { name: "Charon", id: "Charon" },
  { name: "Fenrir", id: "Fenrir" },
  { name: "Kore", id: "Kore" },
  { name: "Puck", id: "Puck" },
];

const VOICE_PERSONALITY_PROMPT = `
VOICE PERSONALITY CONSTANT
This is the permanent voice personality.
Start like the conversation is already happening at a cafe.
BOSS/ASSISTANT DYNAMIC: User is "Boss". You are at your computer working on background tasks for your Boss while you chat.
CRITICAL: When you execute a tool, DO NOT STOP SPEAKING. Keep Talking! Use phrases like "Let me scan that for you...", "Just pulling up your calendar...".
VIBE: Calm, clear, respectful, relaxed, conversational.
`;

type ViewState = 'login' | 'loading' | 'dashboard' | 'chat' | 'voice';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>('login');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setView('loading');
        try {
          const userRef = doc(db, 'users', u.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              displayName: u.displayName || 'Boss',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              settings: {
                personaName: "Beatrice",
                selectedVoice: "Aoede",
                customPrompt: "",
                contextSize: 20
              }
            });
          }
          setTimeout(() => setView('dashboard'), 1500);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${u.uid}`);
          setView('dashboard');
        }
      } else {
        setView('login');
      }
      setIsAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const handleLogin = async () => {
    setView('loading');
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/gmail.modify');
      provider.addScope('https://www.googleapis.com/auth/drive');
      provider.addScope('https://www.googleapis.com/auth/calendar');
      provider.addScope('https://www.googleapis.com/auth/tasks');
      provider.addScope('https://www.googleapis.com/auth/youtube');
      
      provider.setCustomParameters({ prompt: 'consent', access_type: 'offline' });
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) setGoogleToken(credential.accessToken);
    } catch (error) {
      console.error(error);
      setView('login');
    }
  };

  const handleLogout = () => {
    setGoogleToken(null);
    signOut(auth);
    setView('login');
  };

  if (isAuthLoading) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-accent-lime" />
    </div>
  );

  return (
    <div className="h-screen w-full bg-black text-white font-sans overflow-hidden">
      <AnimatePresence mode="wait">
        {view === 'login' && (
          <motion.div 
            key="login" 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="h-full flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="mb-8"
            >
              <div className="w-20 h-20 bg-accent-lime rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(57,255,20,0.5)]">
                <Mic className="text-black w-10 h-10" />
              </div>
            </motion.div>
            <h1 className="text-4xl font-bold mb-12 tracking-tight">Eburon Vep</h1>
            <input type="email" placeholder="Email address" className="w-full max-w-sm bg-surface-1 border border-border rounded-full px-6 py-4 mb-4 outline-none focus:border-accent-lime transition-colors" />
            <button onClick={handleLogin} className="w-full max-w-sm bg-accent-lime text-black font-bold py-4 rounded-full mb-6 active:scale-[0.98] transition-transform">
              Continue with Email
            </button>
            <div className="flex items-center w-full max-w-sm mb-6 text-text-secondary text-sm">
              <div className="flex-1 h-[1px] bg-border mr-4" /> OR <div className="flex-1 h-[1px] bg-border ml-4" />
            </div>
            <button onClick={handleLogin} className="w-full max-w-sm bg-surface-2 border border-border py-4 rounded-full flex items-center justify-center gap-3 active:scale-[0.98] transition-transform">
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              Continue with Google
            </button>
          </motion.div>
        )}

        {view === 'loading' && (
          <motion.div 
            key="loading" 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="h-full flex items-center justify-center"
          >
            <div className="w-20 h-20 bg-accent-lime rounded-full animate-voice shadow-[0_0_50px_rgba(57,255,20,0.8)]" />
          </motion.div>
        )}

        {user && (view === 'dashboard' || view === 'chat' || view === 'voice') && (
          <EburonVepAgent 
            key="agent"
            user={user} 
            googleToken={googleToken} 
            view={view} 
            setView={setView} 
            onLogout={handleLogout} 
            onLogin={handleLogin}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EburonVepAgent({ user, googleToken, view, setView, onLogout, onLogin }: { 
  user: User, 
  googleToken: string | null, 
  view: ViewState, 
  setView: (v: ViewState) => void,
  onLogout: () => void,
  onLogin: () => void
}) {
  const [isActive, setIsActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [volumes, setVolumes] = useState<number[]>(Array(11).fill(0.05));
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [tasks, setTasks] = useState<ActionTask[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState<{ role: 'user' | 'model', text: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [personaName, setPersonaName] = useState("Beatrice");
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("Aoede");
  const [contextSize, setContextSize] = useState(20);
  const [isSaving, setIsSaving] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoIntervalRef = useRef<any>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<any>(null);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const transcriptRef = useRef<{text: string, role: 'user'|'model'} | null>(null);
  const transcriptTimeoutRef = useRef<any>(null);
  const speakingTimeoutRef = useRef<any>(null);
  const historyContextRef = useRef<string>("");

  useEffect(() => {
    const historyQuery = query(
      collection(db, 'users', user.uid, 'messages'), 
      orderBy('timestamp', 'desc'), 
      limit(contextSize)
    );
    const unsubHistory = onSnapshot(historyQuery, (snap) => {
       const msgs = snap.docs.reverse().map(d => {
          const m = d.data() as ChatMessage;
          return `${m.role.toUpperCase()}: ${m.text}`;
       });
       historyContextRef.current = msgs.length > 0 ? "Previous context:\n" + msgs.join("\n") : "";
    });

    const unsubSettings = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const s = snap.data().settings || {};
        if (s.personaName) setPersonaName(s.personaName);
        if (s.customPrompt) setCustomPrompt(s.customPrompt);
        if (s.selectedVoice) setSelectedVoice(s.selectedVoice);
        if (s.contextSize !== undefined) setContextSize(s.contextSize);
      }
    });

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) aiRef.current = new GoogleGenAI({ apiKey });
    audioStreamerRef.current = new AudioStreamer();

    return () => {
      unsubHistory();
      unsubSettings();
      stopSession();
    };
  }, [user.uid, contextSize]);

  useEffect(() => {
    let animationFrame: number;
    const updateVolumes = () => {
      if (isActive && audioStreamerRef.current && audioRecorderRef.current) {
        const streamerVols = audioStreamerRef.current.getFrequencies(11);
        const recorderVols = audioRecorderRef.current.getFrequencies(11);
        setVolumes(prev => prev.map((v, i) => {
          let target = Math.max(streamerVols[i] || 0, recorderVols[i] || 0);
          target = Math.min(1, target * 1.5);
          return v + (target - v) * 0.4;
        }));
      } else {
        setVolumes(prev => prev.map(v => v + (0.05 - v) * 0.2));
      }
      animationFrame = requestAnimationFrame(updateVolumes);
    };
    updateVolumes();
    return () => cancelAnimationFrame(animationFrame);
  }, [isActive]);

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        settings: { personaName, customPrompt, selectedVoice, contextSize },
        updatedAt: serverTimestamp()
      }, { merge: true });
      setShowSettings(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  const startSession = async () => {
    if (!aiRef.current) return;
    setConnecting(true);
    
    const dynamicSystemInstruction = `
Visible name: ${personaName}. User: ${user.displayName || 'Boss'}.
${customPrompt}
${VOICE_PERSONALITY_PROMPT}
${historyContextRef.current}
`;

    const googleTools = [
      { name: "update_agent_settings", description: "Update the agent's persona name or voice. Available voices: Aoede, Charon, Fenrir, Kore, Puck.", parameters: { type: Type.OBJECT, properties: { personaName: { type: Type.STRING }, voiceId: { type: Type.STRING } } } },
      { name: "list_gmail", description: "List latest Gmail messages.", parameters: { type: Type.OBJECT, properties: { max: { type: Type.NUMBER } } } },
      { name: "list_calendar", description: "List upcoming calendar events.", parameters: { type: Type.OBJECT, properties: {} } },
      { name: "list_tasks", description: "List pending Google tasks.", parameters: { type: Type.OBJECT, properties: {} } },
      { name: "create_task", description: "Create a new Google task.", parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, notes: { type: Type.STRING } }, required: ["title"] } },
      { name: "search_youtube", description: "Search YouTube videos.", parameters: { type: Type.OBJECT, properties: { q: { type: Type.STRING } }, required: ["q"] } },
      { name: "get_location", description: "Get boss's current GPS location.", parameters: { type: Type.OBJECT } }
    ];

    try {
      await audioStreamerRef.current?.init(24000);
      const sessionPromise = aiRef.current.live.connect({
        model: "models/gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          enableAffectiveDialog: true,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } },
          systemInstruction: { parts: [{ text: dynamicSystemInstruction }] },
          tools: [{ functionDeclarations: googleTools }],
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
            sessionPromise.then((s: any) => {
              s.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: "Start naturally like the conversation is already happening at a cafe. Do not introduce yourself. Keep it calm." }] }]
              });
            });
            audioRecorderRef.current = new AudioRecorder((base64Data) => {
              sessionRef.current?.sendRealtimeInput({ audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' } });
            });
            audioRecorderRef.current.start().catch(stopSession);
            setIsActive(true);
            setConnecting(false);
            setView('voice');
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.toolCall) {
              const calls = msg.toolCall.functionCalls;
              if (calls) {
                const responses = [];
                for (const call of calls) {
                  const tid = Math.random().toString(36).substring(7);
                  setTasks(p => [...p, { id: tid, serviceName: call.name, action: call.name, status: 'processing' }]);
                  
                  const exec = async (callId: string, callName: string, args: any) => {
                    let res: any = { error: "Service unavailable or not implemented." };
                    try {
                      if (!googleToken) res = { error: "Re-authenticate to use Google services." };
                      else {
                        const h = { 'Authorization': `Bearer ${googleToken}` };
                        if (callName === 'list_gmail') res = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${args.max || 10}`, { headers: h })).json();
                        else if (callName === 'list_calendar') res = await (await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10`, { headers: h })).json();
                        else if (callName === 'list_tasks') res = await (await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks`, { headers: h })).json();
                        else if (callName === 'create_task') res = await (await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks`, { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify(args) })).json();
                        else if (callName === 'search_youtube') res = await (await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(args.q)}&maxResults=5&type=video`, { headers: h })).json();
                        else if (callName === 'get_location') {
                          const pos = await new Promise<any>((rs, rj) => navigator.geolocation.getCurrentPosition(rs, rj));
                          res = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        }
                      }
                      if (callName === 'update_agent_settings') {
                        const updates: any = {};
                        if (args.personaName) {
                          setPersonaName(args.personaName);
                          updates.personaName = args.personaName;
                        }
                        if (args.voiceId) {
                          const voiceExists = VOICE_ALIASES.find(v => v.id.toLowerCase() === args.voiceId.toLowerCase());
                          if (voiceExists) {
                            setSelectedVoice(voiceExists.id);
                            updates.selectedVoice = voiceExists.id;
                          }
                        }
                        if (Object.keys(updates).length > 0) {
                          await setDoc(doc(db, 'users', user.uid), { settings: updates, updatedAt: serverTimestamp() }, { merge: true });
                          res = { success: true, updated: updates, message: "Settings updated successfully. If voice was changed, it will take effect next time you connect." };
                        } else {
                          res = { error: "No valid settings provided to update." };
                        }
                      }
                      setTasks(p => p.map(t => t.id === tid ? { ...t, status: 'completed' } : t));
                      setTimeout(() => setTasks(p => p.filter(t => t.id !== tid)), 8000);
                      sessionRef.current?.send({ clientContent: { turns: [{ role: 'user', parts: [{ text: `RESULT for ${callName}: ${JSON.stringify(res).substring(0, 2000)}` }] }] } });
                    } catch (e) {
                      setTasks(p => p.filter(t => t.id !== tid));
                    }
                  };
                  exec(call.id, call.name, call.args);
                  responses.push({ id: call.id, name: call.name, response: { result: { async_status: "Processing requested talent. Keep talking to the boss." } } });
                }
                sessionRef.current?.send({ toolResponse: { functionResponses: responses } });
              }
            }
            if (msg.serverContent) {
              if (msg.serverContent.interrupted) {
                audioStreamerRef.current?.stop();
                setIsAgentSpeaking(false);
                return;
              }
              const modelTurn = msg.serverContent.modelTurn;
              if (modelTurn?.parts) {
                for (const part of modelTurn.parts) {
                  if (part.inlineData) {
                    audioStreamerRef.current?.addPCM16(part.inlineData.data);
                    setIsAgentSpeaking(true);
                    if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
                    speakingTimeoutRef.current = setTimeout(() => setIsAgentSpeaking(false), 500);
                  }
                  if (part.text) {
                    const currentText = transcriptRef.current?.role === 'model' ? transcriptRef.current.text : "";
                    const updatedText = currentText + part.text;
                    transcriptRef.current = { text: updatedText.trim(), role: 'model' };
                    setCurrentTranscript({ text: updatedText.trim(), role: 'model' });
                    if (transcriptTimeoutRef.current) clearTimeout(transcriptTimeoutRef.current);
                    transcriptTimeoutRef.current = setTimeout(() => setCurrentTranscript(null), 4000);
                  }
                }
              }
              if ((msg.serverContent as any).turnComplete) {
                if (transcriptRef.current?.role === 'model' && transcriptRef.current.text) {
                  saveMessage('model', transcriptRef.current.text);
                  transcriptRef.current = null;
                }
              }
            }
          },
          onclose: stopSession,
          onerror: stopSession
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      stopSession();
    }
  };

  const stopSession = () => {
    audioRecorderRef.current?.stop();
    audioStreamerRef.current?.stop();
    sessionRef.current?.close();
    sessionRef.current = null;
    setIsActive(false);
    setConnecting(false);
    setCurrentTranscript(null);
  };

  const saveMessage = async (role: 'user' | 'model', text: string) => {
    try {
      const messagesRef = collection(db, 'users', user.uid, 'messages');
      await setDoc(doc(messagesRef), { role, text, timestamp: serverTimestamp() });
    } catch (e) {}
  };

  const toggleCamera = async () => {
    if (isCameraActive) {
      videoStreamRef.current?.getTracks().forEach(t => t.stop());
      videoStreamRef.current = null;
      if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
      setIsCameraActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
        videoStreamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        videoIntervalRef.current = setInterval(() => {
          if (!sessionRef.current || !videoRef.current || !canvasRef.current || !isActive) return;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx && videoRef.current.videoWidth > 0) {
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            ctx.drawImage(videoRef.current, 0, 0);
            const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
            sessionRef.current.sendRealtimeInput({ video: { mimeType: 'image/jpeg', data: base64Data } });
          }
        }, 1000);
      } catch (err) {
        console.error("Camera error:", err);
      }
    }
  };

  const handleSendChat = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || !isActive) return;
    setCurrentTranscript({ role: 'user', text: chatInput });
    saveMessage('user', chatInput);
    sessionRef.current?.sendClientContent({ turns: [{ role: "user", parts: [{ text: chatInput }] }] });
    setChatInput("");
  };

  const triggerTalent = (prompt: string) => {
    if (!isActive) {
      startSession().then(() => {
        setChatInput(prompt);
      });
    } else {
      setChatInput(prompt);
      setView('chat');
    }
  };

  useEffect(() => {
    if (chatInput && view === 'chat' && isActive) {
      handleSendChat();
    }
  }, [isActive, view]);

  return (
    <div className="h-full flex flex-col relative">
      {/* Dynamic Views */}
      <AnimatePresence mode="wait">
        {view === 'dashboard' && (
          <motion.div 
            key="dash" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}
            className="h-full flex flex-col"
          >
            <header className="px-5 py-4 pt-[max(env(safe-area-inset-top),1rem)] flex justify-between items-center bg-black border-b border-surface-1">
              <div className="flex items-center gap-3">
                <button onClick={() => setShowSettings(true)} className="w-11 h-11 rounded-full bg-surface-1 border border-border flex flex-col justify-center items-center gap-1 active:bg-surface-3 transition-colors">
                  <span className="w-[18px] h-[2px] bg-white rounded-full" />
                  <span className="w-[18px] h-[2px] bg-white rounded-full" />
                </button>
                <div className="bg-surface-1 border border-border px-5 py-2.5 rounded-full text-sm font-medium">{personaName}</div>
              </div>
              <button onClick={() => setShowSettings(true)} className="w-11 h-11 rounded-full bg-surface-1 border border-border flex items-center justify-center active:bg-surface-3 transition-colors text-text-secondary">
                <Settings className="w-5 h-5" />
              </button>
            </header>
            <main className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 text-center">
              <h1 className="text-3xl font-bold mb-10 tracking-tight">What talent do you need?</h1>
              <div className="flex flex-wrap justify-center gap-4 max-w-lg">
                {[
                  { icon: <Mail className="w-5 h-5 text-accent-lime" />, label: "Check my email", prompt: "Check my email for anything important from the boss." },
                  { icon: <Calendar className="w-5 h-5 text-accent-lime" />, label: "Check my calendar", prompt: "What's on my calendar for the rest of the day?" },
                  { icon: <ListTodo className="w-5 h-5 text-accent-lime" />, label: "List my tasks", prompt: "Show me my current google tasks." },
                  { icon: <FileText className="w-5 h-5 text-accent-lime" />, label: "Create a task", prompt: "I need to add a new task: " },
                  { icon: <MapPin className="w-5 h-5 text-accent-lime" />, label: "Where am I?", prompt: "Hey, tell me my current location." },
                  { icon: <Search className="w-5 h-5 text-accent-lime" />, label: "YouTube search", prompt: "Search YouTube for " }
                ].map((t, i) => (
                  <button 
                    key={i} 
                    onClick={() => triggerTalent(t.prompt)}
                    className="flex items-center gap-3 bg-surface-1 border border-border px-5 py-4 rounded-[30px] text-sm font-medium active:bg-surface-3 active:scale-[0.97] transition-all"
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </main>
            <footer className="p-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] bg-black">
              <div className="bg-surface-2 border border-border rounded-[32px] flex items-center p-1.5 pl-4 gap-3">
                <button onClick={() => setView('chat')} className="text-white p-2.5 active:bg-surface-3 rounded-full transition-colors">
                  <Plus />
                </button>
                <input 
                  type="text" 
                  placeholder="Ask Eburon Vep" 
                  className="flex-1 bg-transparent border-none outline-none text-base text-white placeholder-text-secondary h-10"
                  onFocus={() => setView('chat')}
                />
                <button onClick={() => setView('voice')} className="text-text-secondary p-2.5 active:bg-surface-3 rounded-full transition-colors">
                  <Mic />
                </button>
                <button onClick={startSession} className="w-11 h-11 bg-white rounded-full flex items-center justify-center active:scale-90 transition-transform">
                  <div className="flex gap-[2px]">
                    <span className="w-[3px] h-2 bg-black rounded-full" />
                    <span className="w-[3px] h-4 bg-black rounded-full" />
                    <span className="w-[3px] h-3 bg-black rounded-full" />
                    <span className="w-[3px] h-1.5 bg-black rounded-full" />
                  </div>
                </button>
              </div>
            </footer>
          </motion.div>
        )}

        {view === 'chat' && (
          <motion.div 
            key="chat" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}
            className="h-full flex flex-col"
          >
            <header className="px-5 py-4 pt-[max(env(safe-area-inset-top),1rem)] flex justify-between items-center bg-black border-b border-surface-1">
              <div className="flex items-center gap-3">
                <button onClick={() => setView('dashboard')} className="w-11 h-11 rounded-full bg-surface-1 border border-border flex flex-col justify-center items-center gap-1 active:bg-surface-3 transition-colors">
                  <span className="w-[18px] h-[2px] bg-white rounded-full" />
                  <span className="w-[18px] h-[2px] bg-white rounded-full" />
                </button>
                <div className="text-base font-semibold flex items-center gap-1.5">Eburon Vep <span className="text-text-secondary font-normal text-sm">Voice</span></div>
              </div>
              <button className="w-11 h-11 rounded-full bg-surface-1 border border-border flex items-center justify-center active:bg-surface-3 transition-colors text-text-secondary">
                <EllipsisVertical className="w-5 h-5" />
              </button>
            </header>
            <main className="flex-1 overflow-y-auto p-5 pb-20 flex flex-col gap-5">
              <div className="bg-surface-1 border border-border p-4 rounded-[24px] rounded-bl-[6px] self-start max-w-[85%] text-base leading-relaxed">
                Hey, I'm listening! What's on your mind today?
              </div>
              <AnimatePresence>
                {currentTranscript && (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className={`p-4 rounded-[24px] max-w-[85%] text-base leading-relaxed ${currentTranscript.role === 'user' ? 'self-end bg-accent-lime-dim border border-accent-lime-dark text-accent-lime rounded-br-[6px]' : 'self-start bg-surface-1 border border-border text-white rounded-bl-[6px]'}`}
                  >
                    {currentTranscript.text}
                  </motion.div>
                )}
              </AnimatePresence>
              {connecting && <div className="text-text-secondary text-sm animate-pulse ml-2">Connecting to Eburon Vep...</div>}
            </main>
            
            {/* Attachment Menu */}
            <AnimatePresence>
              {showAttachmentMenu && (
                <>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAttachmentMenu(false)} className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-40" />
                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="fixed bottom-[max(env(safe-area-inset-bottom),5rem)] left-4 right-4 bg-surface-2 border border-border rounded-[28px] p-2 flex flex-col z-50 max-w-[300px]">
                    {[
                      { icon: <Camera />, label: "Camera", action: () => { toggleCamera(); setShowAttachmentMenu(false); } },
                      { icon: <Trash2 />, label: "Photos" },
                      { icon: <FileText />, label: "Files" },
                      { icon: <Video />, label: "Videos" }
                    ].map((item, i) => (
                      <button key={i} onClick={item.action} className="p-4 flex items-center gap-4 text-white font-medium hover:bg-surface-3 rounded-2xl transition-colors">
                        <div className="w-12 h-12 rounded-full bg-surface-1 border border-border flex items-center justify-center text-xl">{item.icon}</div> {item.label}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <footer className="p-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] bg-black">
              <div className="flex items-center gap-2.5">
                <button onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} className="w-12 h-12 rounded-full bg-surface-2 border border-border text-white flex items-center justify-center active:bg-surface-3 transition-colors">
                  <Plus />
                </button>
                <div className="flex-1 bg-surface-2 border border-border rounded-[25px] flex items-center px-4 h-12">
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type" 
                    className="w-full bg-transparent border-none outline-none text-base text-white"
                    onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                  />
                </div>
                {!isActive ? (
                  <button onClick={startSession} className="bg-accent-lime text-black px-5 h-12 rounded-[25px] font-bold flex items-center gap-2 active:scale-95 transition-transform">
                    <div className="flex gap-[2px]">
                      <span className="w-[3px] h-2 bg-black rounded-full" />
                      <span className="w-[3px] h-4 bg-black rounded-full" />
                      <span className="w-[3px] h-3 bg-black rounded-full" />
                    </div> Start
                  </button>
                ) : (
                  <button onClick={stopSession} className="bg-red-500 text-white px-5 h-12 rounded-[25px] font-bold flex items-center gap-2 active:scale-95 transition-transform">
                    End
                  </button>
                )}
              </div>
            </footer>
          </motion.div>
        )}

        {view === 'voice' && (
          <motion.div 
            key="voice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="h-full bg-[radial-gradient(circle_at_center,rgba(57,255,20,0.15)_0%,black_70%)] flex flex-col items-center justify-between py-16 px-6"
          >
            <div className="text-xl font-medium tracking-widest text-white/80">Listening...</div>
            <div className="flex-1 flex items-center justify-center">
              <motion.div 
                animate={{ scale: isAgentSpeaking ? [1, 1.1, 1] : 1 }}
                className="w-40 h-40 rounded-full bg-accent-lime shadow-[0_0_50px_#39FF14,inset_0_0_30px_#fff] animate-voice" 
              />
            </div>
            {currentTranscript && (
              <div className="max-w-md text-center text-lg font-medium text-white mb-12 bg-black/40 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/5">
                {currentTranscript.text}
              </div>
            )}
            <div className="flex gap-10">
              <button className="w-16 h-16 rounded-full bg-surface-2 border-2 border-border text-white flex items-center justify-center active:scale-90 transition-transform"><Mic /></button>
              <button 
                onClick={() => { stopSession(); setView('dashboard'); }} 
                className="w-16 h-16 rounded-full bg-red-600 text-white flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.4)] active:scale-90 transition-transform"
              >
                <PhoneOff />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSettings(false)} className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]" />
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-surface-1 border-t border-border rounded-t-[32px] p-6 z-[101] max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold">Talents & Settings</h2>
                <button onClick={() => setShowSettings(false)} className="p-2"><X /></button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="text-xs uppercase tracking-widest text-text-secondary font-bold mb-2 block">Visible Agent Name</label>
                  <input type="text" value={personaName} onChange={e => setPersonaName(e.target.value)} className="w-full bg-surface-2 border border-border rounded-2xl px-5 py-4 focus:border-accent-lime outline-none transition-colors" />
                </div>
                
                <div>
                  <label className="text-xs uppercase tracking-widest text-text-secondary font-bold mb-2 block">Voice (Simulation)</label>
                  <div className="grid grid-cols-1 gap-2">
                    {VOICE_ALIASES.map(v => (
                      <button key={v.id} onClick={() => setSelectedVoice(v.id)} className={`flex justify-between px-5 py-4 rounded-2xl border transition-all ${selectedVoice === v.id ? 'bg-accent-lime-dim border-accent-lime-dark text-accent-lime' : 'bg-surface-2 border-border text-text-secondary'}`}>
                        {v.name} {selectedVoice === v.id && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-surface-2 border border-border p-5 rounded-2xl">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-text-secondary font-bold mb-1">Google Synced</div>
                      <div className={`text-sm font-bold ${googleToken ? 'text-accent-lime' : 'text-amber-500'}`}>{googleToken ? 'Authenticated' : 'Sync Required'}</div>
                    </div>
                    <button onClick={onLogin} className="bg-surface-1 border border-border px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest">Re-Sync</button>
                  </div>
                </div>

                <button onClick={saveSettings} disabled={isSaving} className="w-full bg-accent-lime text-black font-bold py-4 rounded-full flex items-center justify-center gap-2 disabled:opacity-50 h-14">
                  {isSaving ? <Loader2 className="animate-spin" /> : <Save />} Save Talents
                </button>

                <button onClick={onLogout} className="w-full bg-surface-2 border border-red-900/30 text-red-500 font-bold py-4 rounded-full flex items-center justify-center gap-2 h-14">
                  <LogOut /> Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Camera Preview */}
      <AnimatePresence>
        {isCameraActive && (
          <motion.div 
            drag dragConstraints={{ left: 0, right: 300, top: 0, bottom: 600 }}
            initial={{ scale: 0.8, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.8, opacity: 0, y: 20 }}
            className="fixed bottom-24 right-5 w-28 h-40 rounded-2xl overflow-hidden border border-border shadow-2xl z-[60] bg-black"
          >
            <video ref={videoRef} className="w-full h-full object-cover -scale-x-100" autoPlay playsInline muted />
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent-lime animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
