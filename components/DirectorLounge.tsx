'use client';

import React, { useState } from 'react';

interface FloatingRoom {
  id: string;
  name: string;
  users: number;
  status: 'calme' | 'animé' | 'en feu';
  currentTrack?: string;
  x: string; // Position dans la verrière
  y: string;
}

export default function DirectorLounge() {
  const [selectedRoom, setSelectedRoom] = useState<FloatingRoom | null>(null);
  const [ghostMode, setGhostMode] = useState<boolean>(true);
  const [nightLight, setNightLight] = useState<boolean>(true);

  // Données des salons flottants visibles à travers la baie vitrée
  const floatingRooms: FloatingRoom[] = [
    { id: '1', name: 'Le Bar Central', users: 24, status: 'en feu', currentTrack: 'Tech House VIP 124 BPM', x: '46%', y: '48%' },
    { id: '2', name: 'Salon Flottant #01', users: 9, status: 'animé', currentTrack: 'Lo-Fi Chill & Soul', x: '24%', y: '56%' },
    { id: '3', name: 'Terrasse Sunset', users: 15, status: 'animé', currentTrack: 'Deep Lounge Session', x: '72%', y: '52%' },
    { id: '4', name: 'La Bulle Secrète', users: 4, status: 'calme', currentTrack: 'Murmures & Downtempo', x: '35%', y: '72%' },
    { id: '5', name: 'After-Hours Club', users: 31, status: 'en feu', currentTrack: 'Electro Queer Underground', x: '62%', y: '70%' },
  ];

  return (
    <div className="relative w-full min-h-screen bg-[#07090e] text-slate-100 flex flex-col overflow-hidden select-none font-sans">
      
      {/* 1. HALOS D'AMBIANCE & NÉONS DE FOND */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-b from-purple-600/20 via-cyan-600/10 to-transparent blur-[120px]" />
        <div className="absolute -bottom-20 left-10 w-96 h-96 bg-pink-600/10 rounded-full blur-[100px]" />
        <div className="absolute -bottom-20 right-10 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px]" />
      </div>

      {/* 2. BARRE SUPÉRIEURE DE COMMANDEMENT */}
      <header className="relative z-30 flex items-center justify-between px-8 py-5 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping absolute" />
            <span className="w-3 h-3 rounded-full bg-emerald-400 relative" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-widest uppercase bg-gradient-to-r from-amber-200 via-purple-300 to-cyan-400 bg-clip-text text-transparent">
              Observatoire Privé • vibegay.ca
            </h1>
            <p className="text-[11px] font-mono tracking-wider text-slate-400">
              SALON DU FONDATEUR & DE LA DIRECTION
            </p>
          </div>
        </div>

        {/* Boutons d'état */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setGhostMode(!ghostMode)}
            className={`px-4 py-2 rounded-full text-xs font-mono font-semibold transition-all border ${
              ghostMode
                ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.3)]'
                : 'bg-white/5 border-white/10 text-slate-400'
            }`}
          >
            {ghostMode ? '👁 ÉCOUTE FANTÔME : ACTIVE' : '👁 ÉCOUTE : DÉSACTIVÉE'}
          </button>
          
          <button
            onClick={() => setNightLight(!nightLight)}
            className="px-3 py-2 rounded-full text-xs font-mono bg-white/5 border border-white/10 text-slate-300 hover:border-white/30"
          >
            {nightLight ? '🌙 Ambiance Nuit' : '💡 Ambiance Claire'}
          </button>
        </div>
      </header>

      {/* 3. L'IMMENSE VERRIÈRE EN DÔME (REPRODUCTION DU SCHÉMA) */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-4 lg:p-8 z-10">
        
        {/* Cadre principal de la vitrine */}
        <div className="relative w-full max-w-6xl aspect-[16/9] max-h-[72vh] rounded-[40px] border border-white/15 bg-gradient-to-b from-white/[0.04] via-black/40 to-black/90 shadow-[0_20px_80px_rgba(0,0,0,0.8)] backdrop-blur-2xl overflow-hidden flex items-center justify-center">

          {/* Grille de perspective & Horizon lumineux */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-transparent to-black pointer-events-none" />

          {/* STRUCTURE VECTORIELLE DU DÔME (SVG TRACÉ SUR TON IMAGE) */}
          <svg
            viewBox="0 0 1000 450"
            className="absolute inset-0 w-full h-full pointer-events-none stroke-cyan-200/25 fill-none"
            style={{ filter: 'drop-shadow(0 0 6px rgba(56,189,248,0.25))' }}
          >
            {/* L'Arche Principale (Périmètre du Dôme) */}
            <path d="M 30 450 Q 200 40 500 20 Q 800 40 970 450" strokeWidth="3" className="stroke-white/40" />

            {/* La Colonne Centrale (Axe vertical) */}
            <line x1="500" y1="20" x2="500" y2="450" strokeWidth="2.5" className="stroke-white/50" />

            {/* Traverses Horizontales (Les 2 barres transversales) */}
            <path d="M 80 180 Q 500 170 920 180" strokeWidth="1.8" className="stroke-white/30" />
            <path d="M 15 320 Q 500 310 985 320" strokeWidth="2" className="stroke-white/35" />

            {/* Nervures galbées côté GAUCHE (convergent vers le sommet 500,20) */}
            <path d="M 410 450 Q 430 180 500 20" strokeWidth="1.5" />
            <path d="M 315 450 Q 345 180 500 20" strokeWidth="1.5" />
            <path d="M 210 450 Q 250 180 500 20" strokeWidth="1.5" />
            <path d="M 105 450 Q 145 180 500 20" strokeWidth="1.5" />

            {/* Nervures galbées côté DROIT (convergent vers le sommet 500,20) */}
            <path d="M 590 450 Q 570 180 500 20" strokeWidth="1.5" />
            <path d="M 685 450 Q 655 180 500 20" strokeWidth="1.5" />
            <path d="M 790 450 Q 750 180 500 20" strokeWidth="1.5" />
            <path d="M 895 450 Q 855 180 500 20" strokeWidth="1.5" />
          </svg>

          {/* 4. LES SALONS FLOTTANTS VISIBLES À TRAVERS LES CARREAUX */}
          {floatingRooms.map((room) => {
            const isSelected = selectedRoom?.id === room.id;
            return (
              <div
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                style={{ left: room.x, top: room.y }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-500 group z-20`}
              >
                {/* L'Orbe lumineuse en suspension */}
                <div className={`relative p-3 rounded-2xl backdrop-blur-xl border flex items-center gap-3 transition-transform duration-300 group-hover:scale-110 ${
                  isSelected
                    ? 'bg-purple-900/80 border-cyan-400 shadow-[0_0_35px_rgba(168,85,247,0.7)] scale-110'
                    : 'bg-black/60 border-white/20 hover:border-cyan-400/70 hover:bg-black/80'
                }`}>
                  {/* Pulsation de fréquentation */}
                  <div className={`w-3 h-3 rounded-full ${
                    room.status === 'en feu'
                      ? 'bg-rose-500 animate-ping'
                      : room.status === 'animé'
                      ? 'bg-amber-400'
                      : 'bg-slate-400'
                  }`} />
                  
                  <div>
                    <h4 className="text-xs font-bold text-white tracking-wide group-hover:text-cyan-300">
                      {room.name}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {room.users} connectés
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* 5. HUD D'INSPECTION (Quand tu cliques sur une bulle à travers la vitre) */}
          {selectedRoom && (
            <div className="absolute bottom-6 right-6 z-30 w-80 p-5 rounded-2xl border border-white/20 bg-black/85 backdrop-blur-2xl shadow-2xl animate-fade-in">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-[10px] font-mono tracking-widest uppercase text-cyan-400">
                    Sonde d'Écoute Directe
                  </span>
                  <h3 className="text-base font-black text-white">{selectedRoom.name}</h3>
                </div>
                <button
                  onClick={() => setSelectedRoom(null)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex justify-between border-b border-white/10 pb-1.5">
                  <span className="text-slate-400">Population :</span>
                  <span className="font-mono text-emerald-400 font-bold">{selectedRoom..users} membres</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-1.5">
                  <span className="text-slate-400">Ambiance audio :</span>
                  <span className="font-mono text-purple-300 truncate max-w-[150px]">{selectedRoom.currentTrack}</span>
                </div>
              </div>

              {/* Actions Directes de Modération / Son */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button className="py-2 text-[11px] font-semibold rounded-lg bg-cyan-600/30 border border-cyan-400/50 text-cyan-200 hover:bg-cyan-600/60">
                  Diffuser Audio
                </button>
                <button className="py-2 text-[11px] font-semibold rounded-lg bg-rose-600/30 border border-rose-400/50 text-rose-200 hover:bg-rose-600/60">
                  Modérer le Salon
                </button>
              </div>
            </div>
          )}

          {/* Indicateur de bas de verrière */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-mono tracking-widest text-slate-500 uppercase pointer-events-none">
            [ Baie Vitrée 180° • Vue Panoramique Réseau Live ]
          </div>
        </div>
      </div>

    </div>
  );
}
