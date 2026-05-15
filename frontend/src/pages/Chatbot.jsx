import React, { useState, useRef, useEffect } from 'react';

const SUGGESTIONS = [
  'Comment enregistrer une naissance ?',
  'Quels documents pour un certificat de résidence ?',
  'Comment fonctionne la synchronisation hors-ligne ?',
  'Tarifs des actes d\'état civil',
];

const BOT_REPLIES = {
  'naissance': "Pour enregistrer une naissance, rendez-vous dans **État Civil → Nouvel acte → Naissance**. Vous aurez besoin du nom des parents et de la date de naissance. L'acte sera haché SHA-256 et synchronisé dès la connexion. 👶",
  'certificat': "Le certificat de résidence coûte **2 000 Ar** et nécessite la CIN du citoyen et son adresse dans le Fokontany. Allez dans **Certificats → Nouveau certificat → Résidence**. 🏠",
  'synchronis': "La synchronisation utilise l'algorithme **Last Write Wins (LWW)** avec horodatage. En mode hors-ligne, les données sont stockées dans WatermelonDB et synchronisées automatiquement dès la connexion rétablie. ⚡",
  'tarif': "Voici les tarifs principaux :\n• Acte de naissance : **Gratuit**\n• Certificat résidence : **2 000 Ar**\n• Certificat héritage : **5 000 Ar**\n• Taxe locale annuelle : **25 000 Ar**\n• Permis construction : **50 000 Ar** 💳",
  'default': "Je suis votre assistant CommuneDigit. Je peux vous aider sur la gestion des actes, certificats, paiements et la navigation dans le portail. Que souhaitez-vous savoir ? 🤖",
};

function findReply(msg) {
  const m = msg.toLowerCase();
  if (m.includes('naissance') || m.includes('bébé') || m.includes('birth')) return BOT_REPLIES.naissance;
  if (m.includes('certificat') || m.includes('résidence') || m.includes('residence')) return BOT_REPLIES.certificat;
  if (m.includes('synchro') || m.includes('offline') || m.includes('hors-ligne') || m.includes('connexion')) return BOT_REPLIES.synchronis;
  if (m.includes('tarif') || m.includes('prix') || m.includes('coût') || m.includes('payer') || m.includes('combien')) return BOT_REPLIES.tarif;
  return BOT_REPLIES.default;
}

export default function Chatbot() {
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Bonjour ! Je suis l'assistant CommuneDigit. Je parle français et malagasy. Comment puis-je vous aider ? 🌿", time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { lang, setLang } = useApp();
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (msg) => {
    if (!msg.trim() || loading) return;
    const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role: 'user', text: msg, time }]);
    setInput('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    const reply = findReply(msg);
    setMessages(prev => [...prev, { role: 'bot', text: reply, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }]);
    setLoading(false);
  };

  const handleSubmit = (e) => { e.preventDefault(); send(input); };

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="breadcrumb">🤖 <span>/</span> {lang === 'mg' ? 'Mpanampy AI' : 'Assistant IA'}</div>
          <h1 className="page-title">Assistant virtuel</h1>
          <p className="page-subtitle">Chatbot multilingue — Français · Malagasy · Disponible 24h/24</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={`chip ${lang === 'fr' ? 'active' : ''}`} onClick={() => setLang('fr')}>{lang === 'mg' ? '🇫🇷 Frantsay' : '🇫🇷 Français'}</button>
          <button className={`chip ${lang === 'mg' ? 'active' : ''}`} onClick={() => setLang('mg')}>🇲🇬 Malagasy</button>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Chat */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: 560, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#14b8a6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🤖</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>CommuneDigit AI</div>
              <div style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 5, color: 'var(--emerald-400)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--emerald-400)', display: 'inline-block' }} />
                En ligne · Réponse instantanée
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                  {m.role === 'bot' && (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#14b8a6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', flexShrink: 0 }}>🤖</div>
                  )}
                  <div className={`chatbot-bubble ${m.role}`} style={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                    {m.text.replace(/\*\*(.*?)\*\*/g, '$1')}
                  </div>
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', paddingLeft: m.role === 'bot' ? 36 : 0 }}>{m.time}</div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#14b8a6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>🤖</div>
                <div className="chatbot-bubble bot" style={{ padding: '12px 16px' }}>
                  <span style={{ display: 'flex', gap: 4 }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', display: 'inline-block', animation: `pulse ${0.8 + i * 0.2}s infinite` }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} style={{ padding: '14px 16px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: 10 }}>
            <input
              className="form-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Posez votre question..."
              style={{ flex: 1 }}
              disabled={loading}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !input.trim()}>
              ➤
            </button>
          </form>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Suggestions */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '0.9rem', marginBottom: 12 }}>💡 Questions fréquentes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} className="btn btn-glass" style={{ justifyContent: 'flex-start', padding: '9px 14px', fontSize: '0.8rem', textAlign: 'left' }} onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Capacités */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '0.9rem', marginBottom: 14 }}>🤖 Capacités de l'assistant</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: '📋', t: 'Procédures administratives', d: 'Guidage pas à pas' },
                { icon: '💰', t: 'Tarifs officiels',            d: 'Catalogue à jour' },
                { icon: '📴', t: 'Mode hors-ligne',             d: 'Disponible sans net' },
                { icon: '🌍', t: 'Multilingue',                 d: 'Français · Malagasy' },
              ].map(c => (
                <div key={c.t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.1rem', marginTop: 1 }}>{c.icon}</span>
                  <div>
                    <div style={{ fontSize: '0.83rem', fontWeight: 600 }}>{c.t}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="alert alert-info">
            <span>🔒</span>
            <div style={{ fontSize: '0.78rem', lineHeight: 1.5 }}>
              Les conversations ne sont pas enregistrées. Cet assistant ne peut pas modifier les données du registre.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
