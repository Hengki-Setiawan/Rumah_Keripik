'use client';

import React, { useState, useEffect } from 'react';
import { Phone, ShieldCheck, ArrowRight, RefreshCw, X, AlertCircle, CheckCircle2, UserCheck } from 'lucide-react';

interface ProgressiveIdentityModalProps {
  isOpen: boolean;
  onClose: () => void;
  displayName?: string;
  addressData?: any;
  onVerifiedSuccess: (data: { customer: any; addresses: any[]; isReturningUser: boolean }) => void;
}

export default function ProgressiveIdentityModal({
  isOpen,
  onClose,
  displayName,
  addressData,
  onVerifiedSuccess,
}: ProgressiveIdentityModalProps) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!isOpen) return null;

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDevOtpHint(null);

    if (!phoneNumber.trim() || phoneNumber.replace(/\D/g, '').length < 9) {
      setError('Masukkan nomor WhatsApp yang valid (misal: 08123456789).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/identity/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, purpose: 'checkout_verification' }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Gagal mengirimkan kode OTP');
      }

      setStep('otp');
      setCooldown(60);
      if (data.devModeOtp) {
        setDevOtpHint(data.devModeOtp);
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1);
    setOtpCode(newOtp);

    // Auto-advance focus to next input box
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-box-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      const prevInput = document.getElementById(`otp-box-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fullCode = otpCode.join('');
    if (fullCode.length !== 6) {
      setError('Masukkan 6-digit kode OTP secara lengkap.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/identity/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          code: fullCode,
          displayName,
          addressData,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Verifikasi OTP gagal.');
      }

      onVerifiedSuccess({
        customer: data.customer,
        addresses: data.addresses,
        isReturningUser: data.isReturningUser,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Kode OTP tidak valid.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-gray-900 border border-amber-500/30 rounded-2xl p-6 shadow-2xl text-gray-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 transition-colors p-1 rounded-full hover:bg-gray-800"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 mb-3 border border-amber-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-gray-100">
            {step === 'phone' ? 'Verifikasi WhatsApp (Tahap 3)' : 'Masukkan Kode OTP WA'}
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            {step === 'phone'
              ? 'Konfirmasi nomor WhatsApp Anda untuk update notifikasi pesanan & Midtrans.'
              : `Kode OTP 6-digit telah dikirimkan ke WhatsApp ${phoneNumber}.`}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-500/40 rounded-xl flex items-start gap-2.5 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {devOtpHint && (
          <div className="mb-4 p-3 bg-amber-950/60 border border-amber-500/40 rounded-xl flex items-center justify-between text-amber-300 text-xs">
            <span className="font-semibold">Kode OTP Testing (Dev):</span>
            <span className="font-mono text-base font-bold text-amber-400 bg-amber-900/60 px-2 py-0.5 rounded border border-amber-500/50">
              {devOtpHint}
            </span>
          </div>
        )}

        {/* STEP 1: PHONE NUMBER INPUT */}
        {step === 'phone' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-amber-400" /> Nomor WhatsApp Aktif
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 font-semibold text-sm">+62 / 0</span>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="81234567890"
                  className="w-full pl-20 pr-4 py-2.5 bg-gray-950 border border-gray-700 rounded-xl text-gray-100 placeholder-gray-500 text-sm focus:outline-none focus:border-amber-500 font-medium"
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Kirim Kode OTP WhatsApp <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* STEP 2: OTP CODE INPUT */
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div className="flex justify-center gap-2">
              {otpCode.map((digit, idx) => (
                <input
                  key={idx}
                  id={`otp-box-${idx}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  className="w-11 h-12 text-center text-xl font-bold bg-gray-950 border border-gray-700 rounded-xl text-amber-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors"
                  autoFocus={idx === 0}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.join('').length !== 6}
              className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Verifikasi & Bayar Sekarang
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="hover:text-amber-400 transition-colors"
              >
                Ubah Nomor WA
              </button>
              <button
                type="button"
                disabled={cooldown > 0 || loading}
                onClick={handleRequestOtp}
                className="hover:text-amber-400 transition-colors disabled:opacity-40"
              >
                {cooldown > 0 ? `Kirim Ulang (${cooldown}s)` : 'Kirim Ulang OTP'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
