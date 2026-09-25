import React, { useState } from 'react';
import { UserPlus, Mail, Lock, User, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function StudentManagement() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('admin_token') || '';
      
      const response = await fetch('http://localhost:5087/api/admin/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to create student. Please try again.');
      }

      setMessage({
        type: 'success',
        text: `Student created successfully! ${data?.temporaryPassword ? `Temporary Password: ${data.temporaryPassword}` : ''}`
      });
      
      // Reset form
      setFormData({
        fullName: '',
        email: '',
        password: ''
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Student Management</h1>
        <p className="text-zinc-500 mt-1 text-sm">Add and manage students for IntelliPrep.</p>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200/80 shadow-sm overflow-hidden">
        <div className="p-5 md:p-6 border-b border-zinc-100 bg-zinc-50/50">
          <h2 className="text-lg font-semibold text-zinc-800 flex items-center gap-2">
            <UserPlus size={18} className="text-orange-600" />
            Create New Student
          </h2>
        </div>

        <div className="p-5 md:p-6">
          {message && (
            <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 border ${
              message.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle2 size={18} className="mt-0.5 text-green-600 shrink-0" />
              ) : (
                <AlertCircle size={18} className="mt-0.5 text-red-600 shrink-0" />
              )}
              <div className="text-sm font-medium leading-tight">
                {message.text}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5" htmlFor="fullName">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={16} className="text-zinc-400" />
                </div>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                  className="block w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 sm:text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors"
                  placeholder="e.g. John Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5" htmlFor="email">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={16} className="text-zinc-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 sm:text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors"
                  placeholder="student@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5" htmlFor="password">
                Password <span className="text-zinc-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={16} className="text-zinc-400" />
                </div>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 sm:text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors"
                  placeholder="Leave blank to auto-generate"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex justify-center py-2.5 px-5 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creating...' : 'Create Student'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
