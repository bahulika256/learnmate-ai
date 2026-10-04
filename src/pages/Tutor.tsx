import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ImagePlus,
  Mic,
  Paperclip,
  Plus,
  Send,
  Volume2,
} from 'lucide-react';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

import { supabase } from '../lib/supabase';
import { invoke } from '../lib/api';
import LiveVoice from '../components/LiveVoice';

const LANGUAGES = [
  { name: 'English', code: 'en-IN' },
  { name: 'Hindi', code: 'hi-IN' },
  { name: 'Telugu', code: 'te-IN' },
  { name: 'Tamil', code: 'ta-IN' },
  { name: 'Kannada', code: 'kn-IN' },
  { name: 'Malayalam', code: 'ml-IN' },
  { name: 'Bengali', code: 'bn-IN' },
  { name: 'Marathi', code: 'mr-IN' },
  { name: 'Gujarati', code: 'gu-IN' },
  { name: 'Punjabi', code: 'pa-IN' },
  { name: 'Urdu', code: 'ur-IN' },
  { name: 'Spanish', code: 'es-ES' },
  { name: 'French', code: 'fr-FR' },
  { name: 'German', code: 'de-DE' },
  { name: 'Portuguese', code: 'pt-PT' },
  { name: 'Italian', code: 'it-IT' },
  { name: 'Japanese', code: 'ja-JP' },
  { name: 'Korean', code: 'ko-KR' },
  { name: 'Chinese', code: 'zh-CN' },
  { name: 'Arabic', code: 'ar-SA' },
  { name: 'Russian', code: 'ru-RU' },
  { name: 'Turkish', code: 'tr-TR' },
  { name: 'Dutch', code: 'nl-NL' },
  { name: 'Polish', code: 'pl-PL' },
  { name: 'Thai', code: 'th-TH' },
  { name: 'Vietnamese', code: 'vi-VN' },
  { name: 'Indonesian', code: 'id-ID' },
  { name: 'Swedish', code: 'sv-SE' },
  { name: 'Greek', code: 'el-GR' },
  { name: 'Hebrew', code: 'he-IL' },
];

export default function Tutor() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [convos, setConvos] = useState<any[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [subject, setSubject] = useState('Mathematics');
  const [language, setLanguage] = useState('English');
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const end = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (initialized.current) return;

    initialized.current = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);

      if (!user) return;

      const [p, c] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single(),

        supabase
          .from('conversations')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', {
            ascending: false,
          }),
      ]);

      setProfile(p.data);

      const savedLanguage =
        p.data?.preferred_language || 'English';

      const supportedLanguage = LANGUAGES.some(
        (item) => item.name === savedLanguage
      );

      setLanguage(
        supportedLanguage
          ? savedLanguage
          : 'English'
      );

      const conversations = c.data ?? [];

      setConvos(conversations);

      const newChat = searchParams.get('new');
      const conversationId = searchParams.get('conversation');

      // History -> New Chat
      // Create a brand-new conversation and STOP here.
      // Do not automatically open the previous conversation.
      if (newChat === '1') {
        const { data: newConv, error } = await supabase
          .from('conversations')
          .insert({
            user_id: user.id,
            title: 'New learning session',
          })
          .select()
          .single();

        if (error) {
          console.error('Could not create new conversation:', error);
          alert('Could not create a new chat. Please try again.');
          return;
        }

        if (newConv) {
          setConvos((v) => [newConv, ...v]);
          setConversation(newConv);
          setMessages([]);
          setText('');
          setImage(null);
        }

        return;
      }

      // History -> existing conversation
      // Open exactly the conversation selected by the user.
      if (conversationId) {
        const selected = conversations.find(
          (item: any) => item.id === conversationId
        );

        if (selected) {
          await openConversation(selected);
          return;
        }
      }

      // Normal /tutor entry -> open the latest conversation.
      if (conversations[0]) {
        await openConversation(conversations[0]);
      }
    })();
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages]);

  async function openConversation(c: any) {
    setConversation(c);

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', c.id)
      .order('created_at');

    setMessages(data ?? []);
  }

  async function newConversation() {
    if (!user) return;

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        title: 'New learning session',
      })
      .select()
      .single();

    if (!error && data) {
      setConvos((v) => [data, ...v]);
      setConversation(data);
      setMessages([]);
    }
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();

    if (
      !user ||
      (!text.trim() && !image) ||
      busy
    ) {
      return;
    }

    setBusy(true);

    try {
      let c = conversation;

      if (!c) {
        const { data, error } =
          await supabase
            .from('conversations')
            .insert({
              user_id: user.id,
              title:
                text.slice(0, 60) ||
                'Image question',
              subject_id: null,
            })
            .select()
            .single();

        if (error) throw error;

        c = data;

        setConversation(c);

        if (c) {
          setConvos((v) => [
            c,
            ...v,
          ]);
        }
      }

      if (!c) {
        throw new Error(
          'Could not create conversation'
        );
      }

      let imageUrl:
        | string
        | undefined;

      if (image) {
        const ext =
          image.name
            .split('.')
            .pop() || 'jpg';

        const path =
          `${user.id}/${crypto.randomUUID()}.${ext}`;

        const up =
          await supabase.storage
            .from('student-files')
            .upload(
              path,
              image,
              {
                contentType:
                  image.type,
                upsert: false,
              }
            );

        if (up.error) {
          throw up.error;
        }

        imageUrl = path;
      }

      const content =
        text.trim() ||
        'Please explain the uploaded image.';

      const {
        data: um,
        error: ue,
      } = await supabase
        .from('messages')
        .insert({
          conversation_id: c.id,
          user_id: user.id,
          role: 'user',
          content,
          image_url: imageUrl,
        })
        .select()
        .single();

      if (ue) throw ue;

      setMessages((v) => [
        ...v,
        um,
      ]);

      setText('');
      setImage(null);

      const history = [
        ...messages,
        {
          role: 'user',
          content,
        },
      ]
        .slice(-10)
        .map((m: any) => ({
          role: m.role,
          content: m.content,
        }));

      let imageData:
        | string
        | undefined;

      if (image) {
        imageData =
          await new Promise<string>(
            (
              resolve,
              reject
            ) => {
              const r =
                new FileReader();

              r.onload = () =>
                resolve(
                  String(r.result)
                );

              r.onerror = reject;

              r.readAsDataURL(
                image
              );
            }
          );
      }

      const result =
        await invoke<any>(
          'ai-tutor',
          {
            message: content,
            conversationId:
              c.id,
            subject,
            grade:
              profile?.grade ||
              10,
            preferredLanguage:
              language,
            recentHistory:
              history,
            imageData,
          }
        );

      const assistant =
        result?.content ||
        result?.answer ||
        'I could not generate a response right now.';

      const {
        data: am,
        error: ae,
      } = await supabase
        .from('messages')
        .insert({
          conversation_id: c.id,
          user_id: user.id,
          role: 'assistant',
          content: assistant,
        })
        .select()
        .single();

      if (ae) throw ae;

      if (am) {
        setMessages((v) => [
          ...v,
          am,
        ]);
      }

      await supabase
        .from('conversations')
        .update({
          title:
            c.title ===
            'New learning session'
              ? content.slice(
                  0,
                  60
                )
              : c.title,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          c.id
        );
    } catch (err: any) {
      alert(
        err?.message ||
          'Something went wrong.'
      );
    } finally {
      setBusy(false);
    }
  }

  function getLanguageCode() {
    return (
      LANGUAGES.find(
        (item) =>
          item.name === language
      )?.code ||
      'en-IN'
    );
  }

  function voice() {
    const SR =
      (window as any)
        .SpeechRecognition ||
      (window as any)
        .webkitSpeechRecognition;

    if (!SR) {
      alert(
        'Speech recognition is not supported in this browser.'
      );

      return;
    }

    const r = new SR();

    r.lang =
      getLanguageCode();

    r.interimResults = false;

    r.continuous = false;

    r.onstart = () =>
      setListening(true);

    r.onend = () =>
      setListening(false);

    r.onresult = (
      e: any
    ) => {
      setText(
        e.results?.[0]?.[0]
          ?.transcript || ''
      );
    };

    r.onerror = () =>
      setListening(false);

    r.start();
  }

  function speak(
    content: string
  ) {
    const synth =
      window.speechSynthesis;

    if (!synth) return;

    if (speaking) {
      synth.cancel();

      setSpeaking(false);

      return;
    }

    const u =
      new SpeechSynthesisUtterance(
        content
      );

    u.lang =
      getLanguageCode();

    const voices =
      synth.getVoices();

    const languagePrefix =
      getLanguageCode()
        .split('-')[0]
        .toLowerCase();

    const matchingVoice =
      voices.find(
        (voice) =>
          voice.lang
            .toLowerCase()
            .startsWith(
              languagePrefix
            )
      );

    if (matchingVoice) {
      u.voice =
        matchingVoice;
    }

    u.onend = () =>
      setSpeaking(false);

    u.onerror = () =>
      setSpeaking(false);

    setSpeaking(true);

    synth.speak(u);
  }

  return (
    <div className="h-screen flex overflow-hidden">

      {/* Conversations */}
      <aside className="hidden lg:flex w-72 bg-white border-r flex-col">

        <div className="p-4 flex justify-between">

          <h2 className="font-black">
            Conversations
          </h2>

          <button
            onClick={newConversation}
            className="btn btn-soft p-2"
            aria-label="New conversation"
          >
            <Plus size={17} />
          </button>

        </div>

        <div className="overflow-auto px-3 space-y-1">

          {convos.map((c) => (
            <button
              key={c.id}
              onClick={() =>
                openConversation(c)
              }
              className={`w-full text-left p-3 rounded-xl text-sm ${
                conversation?.id ===
                c.id
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'hover:bg-slate-50'
              }`}
            >
              {c.title}
            </button>
          ))}

        </div>

      </aside>

      {/* Main Tutor */}
      <section className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="bg-white border-b p-4 flex flex-wrap gap-2 items-center justify-between">

          <div>

            <h1 className="font-black">
              AI Tutor
            </h1>

            <p className="text-xs muted">
              Patient, grade-aware learning support
            </p>

          </div>

          <div className="flex gap-2">

            {/* Subject */}
            <select
              className="input !w-auto py-2"
              value={subject}
              onChange={(e) =>
                setSubject(
                  e.target.value
                )
              }
            >
              <option>
                Mathematics
              </option>

              <option>
                Physics
              </option>

              <option>
                Chemistry
              </option>
            </select>

            {/* Language */}
            <select
              className="input !w-auto py-2 max-w-[220px]"
              value={language}
              onChange={(e) =>
                setLanguage(
                  e.target.value
                )
              }
              aria-label="Select language"
            >
              {LANGUAGES.map(
                (item) => (
                  <option
                    key={item.name}
                    value={
                      item.name
                    }
                  >
                    {item.name}
                  </option>
                )
              )}
            </select>

          </div>

        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 md:p-8">

          {!messages.length ? (

            <div className="max-w-2xl mx-auto text-center pt-16">

              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl grid place-items-center mx-auto">
                <BrainIcon />
              </div>

              <h2 className="text-3xl font-black mt-5">
                What would you like to learn?
              </h2>

              <p className="muted mt-2">
                Ask a concept question,
                solve a problem,
                or upload a page.
              </p>

              <div className="grid md:grid-cols-2 gap-3 mt-7 text-left">

                {[
                  'Explain Newton’s second law with an example.',
                  'Help me solve 2x + 5 = 15 step by step.',
                  'Why do acids react with bases?',
                  'Give me a practice question on algebra.',
                ].map(
                  (q) => (

                    <button
                      key={q}
                      onClick={() =>
                        setText(q)
                      }
                      className="card p-4 hover:border-indigo-300 text-sm"
                    >
                      {q}
                    </button>

                  )
                )}

              </div>

            </div>

          ) : (

            <div className="max-w-3xl mx-auto space-y-5">

              {messages.map(
                (m) => (

                  <div
                    key={m.id}
                    className={`flex ${
                      m.role ===
                      'user'
                        ? 'justify-end'
                        : 'justify-start'
                    }`}
                  >

                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        m.role ===
                        'user'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border'
                      }`}
                    >

                      {m.role ===
                      'assistant' ? (

                        <div className="leading-7 text-slate-800">

                          <ReactMarkdown
                            remarkPlugins={[
                              remarkMath,
                            ]}
                            rehypePlugins={[
                              rehypeKatex,
                            ]}
                          >
                            {m.content}
                          </ReactMarkdown>

                        </div>

                      ) : (

                        <div className="whitespace-pre-wrap leading-7">
                          {m.content}
                        </div>

                      )}

                      {m.image_url && (
                        <img
                          src={
                            m.image_url
                          }
                          alt="Uploaded learning question"
                          className="max-h-56 rounded-xl mt-3"
                        />
                      )}

                      {m.role ===
                        'assistant' && (
                        <button
                          onClick={() =>
                            speak(
                              m.content
                            )
                          }
                          className="mt-2 text-xs flex items-center gap-1 opacity-70"
                        >
                          <Volume2
                            size={14}
                          />

                          {speaking
                            ? 'Stop'
                            : 'Listen'}
                        </button>
                      )}

                    </div>

                  </div>

                )
              )}

              <div ref={end} />

            </div>

          )}

        </div>

        {/* Live Voice */}
        <div className="border-t bg-white px-3 pt-3">

          <div className="max-w-3xl mx-auto">

            <LiveVoice
              subject={subject}
              language={language}
            />

          </div>

        </div>

        {/* Normal input */}
        <form
          onSubmit={send}
          className="bg-white border-t p-3 md:p-4"
        >

          <div className="max-w-3xl mx-auto">

            <div className="flex gap-2 items-end">

              {/* Image */}
              <label className="btn btn-soft p-3 cursor-pointer">

                <Paperclip
                  size={18}
                />

                <input
                  className="hidden"
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setImage(
                      e.target
                        .files?.[0] ||
                        null
                    )
                  }
                />

              </label>

              {/* Quick voice */}
              <button
                type="button"
                onClick={voice}
                className={`btn p-3 ${
                  listening
                    ? 'bg-red-50 text-red-600'
                    : 'btn-soft'
                }`}
                aria-label="Voice input"
              >
                <Mic size={18} />
              </button>

              {/* Text */}
              <textarea
                className="input resize-none min-h-12 max-h-36"
                rows={1}
                value={text}
                onChange={(e) =>
                  setText(
                    e.target.value
                  )
                }
                placeholder="Ask your tutor…"
              />

              {/* Send */}
              <button
                disabled={
                  busy ||
                  (!text.trim() &&
                    !image)
                }
                className="btn btn-primary p-3"
                aria-label="Send"
              >
                <Send size={18} />
              </button>

            </div>

            {/* Selected image */}
            {image && (

              <div className="text-xs mt-2 text-indigo-700 flex items-center gap-2">

                <ImagePlus
                  size={14}
                />

                {image.name}

                <button
                  type="button"
                  onClick={() =>
                    setImage(null)
                  }
                  className="underline"
                >
                  remove
                </button>

              </div>

            )}

          </div>

        </form>

      </section>

    </div>
  );
}

function BrainIcon() {
  return (
    <span className="text-3xl">
      🧠
    </span>
  );
}