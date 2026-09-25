import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate(); // අලුත් පිටුවට යන්න මේක පාවිච්චි කරන්නේ

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    
    try {
      const response = await fetch('http://localhost:5087/api/Auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          localStorage.setItem('token', data.token);
        }
        // Login සාර්ථක නම් තත්පරේකින් Dashboard එකට යවනවා
        setMessage("✅ සාර්ථකයි! (Loading Dashboard...)");
        setTimeout(() => {
          navigate('/dashboard');
        }, 1000);
      } else {
        setMessage("❌ පිවිසීම අසාර්ථකයි. (Login Failed)");
      }
    } catch (error) {
      setMessage("⚠️ සේවාදායකය හා සම්බන්ධ විය නොහැක.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-orange-400 to-orange-600 text-white flex-col justify-center items-start p-16 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-white opacity-10 rounded-full mix-blend-overlay blur-2xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-orange-300 opacity-20 rounded-full mix-blend-overlay blur-3xl"></div>
        
        <div className="relative z-10">
          <h1 className="text-5xl font-extrabold tracking-tight mb-4 drop-shadow-md">
            IntelliPrep <span className="text-orange-200">Admin</span>
          </h1>
          <p className="text-xl font-light mb-8 max-w-md leading-relaxed text-orange-50">
            Intelligent exam preparation and seamless student management platform.
          </p>
          <div className="mt-12 bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl shadow-lg max-w-md">
            <h3 className="text-2xl font-bold mb-2">ඔබගේ පාලක පැනලය</h3>
            <p className="text-orange-100 text-sm leading-relaxed">
              දත්ත කළමනාකරණය, ප්‍රශ්න පත්‍ර යාවත්කාලීන කිරීම සහ සිසුන්ගේ ප්‍රගතිය නිරීක්ෂණය කිරීම සඳහා මෙතැනින් පිවිසෙන්න.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white shadow-[0_0_40px_rgba(0,0,0,0.05)] z-10">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
            <p className="text-gray-500 text-sm">Please enter your details to sign in.</p>
          </div>

          {message && (
            <div className={`p-4 rounded-lg text-sm font-semibold transition-all ${
              message.includes('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-700">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none bg-gray-50 focus:bg-white shadow-sm"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-700">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none bg-gray-50 focus:bg-white shadow-sm"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl shadow-lg font-bold text-white bg-orange-600 hover:bg-orange-700 transition-all active:scale-[0.98]"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}