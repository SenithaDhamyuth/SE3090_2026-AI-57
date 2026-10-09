import React, { useEffect, useState } from 'react';
import {
  UserPlus, Mail, User, AlertCircle, CheckCircle2,
  Pencil, Trash2, Users, CalendarDays, LoaderCircle,
  X, Phone, MapPin, School, Image
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'https://intelliprep-rhx3.onrender.com') + '';

// ── Default form state (all fields) ──────────────────────────────────────────
const EMPTY_FORM = {
  fullName: '',
  email: '',
  initialPassword: '',
  phoneNumber: '',
  address: '',
  college: '',
};

// Phone number regex: optional leading +, 7-20 digits/spaces/dashes/parens
const PHONE_REGEX = /^[+]?[0-9\s\-()]{7,20}$/;

// ── Avatar — shows profileImageUrl or a fallback initial-letter circle ────────
function StudentAvatar({ student, size = 8 }) {
  const [imgError, setImgError] = useState(false);
  const hasImg = student.profileImageUrl && !imgError;

  const sizeClass = `w-${size} h-${size}`;

  if (hasImg) {
    return (
      <img
        src={student.profileImageUrl}
        alt={student.fullName}
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover border border-gray-100 shadow-sm shrink-0`}
      />
    );
  }

  return (
    <div className={`${sizeClass} rounded-full bg-orange-500 flex items-center justify-center shrink-0 shadow-sm`}>
      <span className="text-[11px] font-bold text-white">
        {student.fullName?.[0]?.toUpperCase() || '?'}
      </span>
    </div>
  );
}

// ── Add Student Modal ─────────────────────────────────────────────────────────
function AddStudentModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Trap Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'phoneNumber') {
      if (value && !PHONE_REGEX.test(value)) {
        setPhoneError('Invalid phone format. Use digits, spaces, dashes or parentheses (7–20 chars).');
      } else {
        setPhoneError('');
      }
    }
    if (name === 'initialPassword') {
      const pwdRegex = /^(?=.*[@!#$%^&*]).{6,72}$/;
      if (value && !pwdRegex.test(value)) {
        setPasswordError('Password must be at least 6 characters and include at least one special character.');
      } else {
        setPasswordError('');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Client-side phone validation before submit
    if (formData.phoneNumber && !PHONE_REGEX.test(formData.phoneNumber)) {
      setPhoneError('Invalid phone format. Use digits, spaces, dashes or parentheses (7–20 chars).');
      return;
    }
    const pwdRegex = /^(?=.*[@!#$%^&*]).{6,72}$/;
    if (!pwdRegex.test(formData.initialPassword)) {
      setPasswordError('Password must be at least 6 characters and include at least one special character.');
      return;
    }
    
    setLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('admin_token') || '';
      // Only send non-empty optional fields
      const payload = {
        fullName: formData.fullName,
        email: formData.email,
        initialPassword: formData.initialPassword,
        ...(formData.phoneNumber ? { phoneNumber: formData.phoneNumber } : {}),
        ...(formData.address    ? { address: formData.address }         : {}),
        ...(formData.college    ? { college: formData.college }         : {}),
      };
      const response = await fetch(`${API_BASE}/api/admin/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || 'Failed to create student. Please try again.');

      setMessage({ type: 'success', text: 'Student account created successfully.' });
      setFormData(EMPTY_FORM);
      // Notify parent to refresh and optionally close after short delay
      onSuccess();
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
              <UserPlus size={17} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">Add New Student</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Fill in the details to create a student account.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-gray-100 text-gray-400 hover:text-gray-700 hover:border-gray-200 transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {message && (
            <div className={`mb-5 p-3.5 rounded-xl flex items-start gap-3 border ${
              message.type === 'success'
                ? 'bg-green-50 border-green-100 text-green-800'
                : 'bg-red-50 border-red-100 text-red-800'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle2 size={17} className="mt-0.5 text-green-600 shrink-0" />
              ) : (
                <AlertCircle size={17} className="mt-0.5 text-red-600 shrink-0" />
              )}
              <p className="text-[13px] font-medium leading-snug">{message.text}</p>
            </div>
          )}

          <form id="add-student-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-[10px] tracking-wider font-semibold text-gray-400 mb-1.5 uppercase" htmlFor="modal-fullName">
                Full Name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User size={15} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  id="modal-fullName"
                  name="fullName"
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all bg-gray-50/50"
                  placeholder="e.g. Amal Perera"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-[10px] tracking-wider font-semibold text-gray-400 mb-1.5 uppercase" htmlFor="modal-email">
                Email Address <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail size={15} className="text-gray-400" />
                </div>
                <input
                  type="email"
                  id="modal-email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all bg-gray-50/50"
                  placeholder="student@example.com"
                />
              </div>
            </div>

            {/* Secure handoff reminder */}
            <div className="flex items-start gap-3 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-orange-500">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-[11px] text-orange-700 leading-relaxed">
                A <strong>secure initial password</strong> must be at least 6 characters and include at least one special character. Share it with the student securely; the server stores only its hash.
              </p>
            </div>

            {/* Initial Password */}
            <div>
              <label className="block text-[10px] tracking-wider font-semibold text-gray-400 mb-1.5 uppercase" htmlFor="modal-initialPassword">
                Initial Password <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                id="modal-initialPassword"
                name="initialPassword"
                required
                minLength={6}
                maxLength={72}
                autoComplete="new-password"
                value={formData.initialPassword}
                onChange={handleChange}
                className={`block w-full px-4 py-2.5 border rounded-xl text-[13px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 transition-all bg-gray-50/50 ${
                  passwordError
                    ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                    : 'border-gray-200 focus:ring-orange-500/20 focus:border-orange-500'
                }`}
                placeholder="At least 6 chars + special char"
              />
              {passwordError && (
                <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1">
                  <AlertCircle size={11} /> {passwordError}
                </p>
              )}
            </div>

            {/* Phone Number (optional) */}
            <div>
              <label className="block text-[10px] tracking-wider font-semibold text-gray-400 mb-1.5 uppercase" htmlFor="modal-phoneNumber">
                Phone Number <span className="text-gray-300 font-normal normal-case">optional</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Phone size={15} className="text-gray-400" />
                </div>
                <input
                  type="tel"
                  id="modal-phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  className={`block w-full pl-10 pr-4 py-2.5 border rounded-xl text-[13px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 transition-all bg-gray-50/50 ${
                    phoneError
                      ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                      : 'border-gray-200 focus:ring-orange-500/20 focus:border-orange-500'
                  }`}
                  placeholder="+94 77 123 4567"
                />
              </div>
              {phoneError && (
                <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1">
                  <AlertCircle size={11} /> {phoneError}
                </p>
              )}
            </div>

            {/* Address (optional) */}
            <div>
              <label className="block text-[10px] tracking-wider font-semibold text-gray-400 mb-1.5 uppercase" htmlFor="modal-address">
                Address <span className="text-gray-300 font-normal normal-case">optional</span>
              </label>
              <div className="relative">
                <div className="absolute top-3 left-0 pl-3.5 flex items-start pointer-events-none">
                  <MapPin size={15} className="text-gray-400" />
                </div>
                <textarea
                  id="modal-address"
                  name="address"
                  rows={2}
                  value={formData.address}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all bg-gray-50/50 resize-none"
                  placeholder="Street, City, Province"
                />
              </div>
            </div>

            {/* College (optional) */}
            <div>
              <label className="block text-[10px] tracking-wider font-semibold text-gray-400 mb-1.5 uppercase" htmlFor="modal-college">
                College / School <span className="text-gray-300 font-normal normal-case">optional</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <School size={15} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  id="modal-college"
                  name="college"
                  value={formData.college}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all bg-gray-50/50"
                  placeholder="e.g. Ananda College, Colombo"
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-student-form"
            disabled={loading || !!phoneError}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-orange-600 hover:bg-orange-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {loading ? <LoaderCircle size={15} className="animate-spin" /> : <UserPlus size={15} />}
            {loading ? 'Creating...' : 'Create Student'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StudentManagement() {
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [message, setMessage] = useState(null);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [editForm, setEditForm] = useState({ fullName: '', email: '' });
  const [showAddModal, setShowAddModal] = useState(false);

  const getToken = () => localStorage.getItem('admin_token') || '';

  const fetchStudents = async () => {
    const token = getToken();
    try {
      setLoadingStudents(true);
      const response = await fetch(`${API_BASE}/api/admin/students`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || 'Unable to load students.');
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => { fetchStudents(); }, []);

  const startEditing = (student) => {
    setEditingStudentId(student.id);
    setEditForm({ fullName: student.fullName, email: student.email });
  };

  const cancelEditing = () => {
    setEditingStudentId(null);
    setEditForm({ fullName: '', email: '' });
  };

  const handleEditSave = async (id) => {
    const token = getToken();
    try {
      const response = await fetch(`${API_BASE}/api/admin/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ fullName: editForm.fullName, email: editForm.email }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || 'Failed to update student.');
      setMessage({ type: 'success', text: data?.message || 'Student updated successfully.' });
      setEditingStudentId(null);
      setEditForm({ fullName: '', email: '' });
      await fetchStudents();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Are you sure you want to delete this student?');
    if (!confirmed) return;
    const token = getToken();
    try {
      const response = await fetch(`${API_BASE}/api/admin/students/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || 'Failed to delete student.');
      setMessage({ type: 'success', text: data?.message || 'Student deleted successfully.' });
      await fetchStudents();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const newestStudent = students.length > 0 ? students[0] : null;

  return (
    <div className="max-w-[1200px] mx-auto p-6 md:p-8 space-y-8 bg-gray-50/50 min-h-[calc(100vh-3.5rem)]">

      {/* ── Add Student Modal ── */}
      {showAddModal && (
        <AddStudentModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => fetchStudents()}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Student Management</h1>
          <p className="text-[13px] text-gray-500 mt-1">Add, edit, and manage IntelliPrep student accounts.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-orange-600 hover:bg-orange-700 shadow-sm transition-all active:scale-[0.98] shrink-0"
        >
          <UserPlus size={15} />
          Add Student
        </button>
      </div>

      {/* ── Page-level alert ── */}
      {message && (
        <div className={`p-4 rounded-xl flex items-start gap-3 border ${
          message.type === 'success'
            ? 'bg-green-50 border-green-100 text-green-800'
            : 'bg-red-50 border-red-100 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 size={17} className="mt-0.5 text-green-600 shrink-0" />
          ) : (
            <AlertCircle size={17} className="mt-0.5 text-red-600 shrink-0" />
          )}
          <p className="text-[13px] font-medium leading-snug flex-1">{message.text}</p>
          <button
            onClick={() => setMessage(null)}
            className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Total Students */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-[10px] tracking-wider text-gray-400 font-semibold uppercase">Total Students</span>
            <span className="text-4xl font-bold text-gray-900 mt-2">{students.length}</span>
          </div>
          <div className="bg-orange-50 text-orange-600 rounded-full p-2.5">
            <Users size={18} />
          </div>
        </div>

        {/* Active Accounts */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-[10px] tracking-wider text-gray-400 font-semibold uppercase">Active Accounts</span>
            <span className="text-4xl font-bold text-gray-900 mt-2">{students.length}</span>
          </div>
          <div className="bg-gray-50 text-gray-600 rounded-full p-2.5">
            <User size={18} />
          </div>
        </div>

        {/* Newest Student */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex justify-between items-start">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] tracking-wider text-gray-400 font-semibold uppercase">Newest Student</span>
            <span className="text-lg font-bold text-gray-900 mt-4 truncate pr-4">
              {newestStudent ? newestStudent.fullName : 'No students yet'}
            </span>
          </div>
          <div className="bg-gray-50 text-gray-600 rounded-full p-2.5 shrink-0">
            <CalendarDays size={18} />
          </div>
        </div>
      </div>

      {/* ── Student Directory Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden pb-4">
        <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Student Directory</h2>
            <p className="text-[13px] text-gray-500 mt-1">{students.length} registered students</p>
          </div>
        </div>

        <div className="overflow-x-auto px-8">
          {loadingStudents ? (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-3">
              <LoaderCircle className="h-6 w-6 animate-spin text-orange-500" />
              <span className="text-sm font-medium">Loading students...</span>
            </div>
          ) : students.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center border-t border-gray-100">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mb-4">
                <Users size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">No students found</h3>
              <p className="text-[13px] text-gray-500 mt-1">Click "Add Student" to create your first student account.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="py-3 pr-4 text-[10px] tracking-wider text-gray-400 uppercase font-semibold border-b border-gray-100">Student ID</th>
                  <th className="px-4 py-3 text-[10px] tracking-wider text-gray-400 uppercase font-semibold border-b border-gray-100">Full Name</th>
                  <th className="px-4 py-3 text-[10px] tracking-wider text-gray-400 uppercase font-semibold border-b border-gray-100">Email</th>
                  <th className="px-4 py-3 text-[10px] tracking-wider text-gray-400 uppercase font-semibold border-b border-gray-100">Phone</th>
                  <th className="px-4 py-3 text-[10px] tracking-wider text-gray-400 uppercase font-semibold border-b border-gray-100">Address</th>
                  <th className="px-4 py-3 text-[10px] tracking-wider text-gray-400 uppercase font-semibold border-b border-gray-100">College</th>
                  <th className="px-4 py-3 text-[10px] tracking-wider text-gray-400 uppercase font-semibold border-b border-gray-100">Created At</th>
                  <th className="pl-4 py-3 text-right text-[10px] tracking-wider text-gray-400 uppercase font-semibold border-b border-gray-100">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50/50 transition-colors group">
                    {/* ID */}
                    <td className="py-5 pr-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-50 text-[11px] font-mono font-semibold text-gray-500 border border-gray-100">
                        #{student.id}
                      </span>
                    </td>

                    {/* Full Name — with avatar */}
                    <td className="px-4 py-5">
                      {editingStudentId === student.id ? (
                        <input
                          type="text"
                          value={editForm.fullName}
                          onChange={(e) => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                          className="w-full rounded-xl border border-gray-200 px-4 py-2 text-[13px] text-gray-900 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white"
                        />
                      ) : (
                        <div className="flex items-center gap-3">
                          <StudentAvatar student={student} size={8} />
                          <span className="text-[13px] font-semibold text-gray-900 whitespace-nowrap">
                            {student.fullName}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-5">
                      {editingStudentId === student.id ? (
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full rounded-xl border border-gray-200 px-4 py-2 text-[13px] text-gray-900 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white"
                        />
                      ) : (
                        <span className="text-[13px] text-gray-500">{student.email}</span>
                      )}
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-5">
                      <span className="text-[13px] text-gray-500">{student.phoneNumber || '—'}</span>
                    </td>

                    {/* Address */}
                    <td className="px-4 py-5 max-w-[150px] truncate">
                      <span className="text-[13px] text-gray-500" title={student.address}>{student.address || '—'}</span>
                    </td>

                    {/* College */}
                    <td className="px-4 py-5 max-w-[150px] truncate">
                      <span className="text-[13px] text-gray-500" title={student.college}>{student.college || '—'}</span>
                    </td>

                    {/* Created At */}
                    <td className="px-4 py-5">
                      <span className="text-[12px] text-gray-400 whitespace-nowrap">
                        {new Date(student.createdAt).toLocaleDateString()}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="pl-4 py-5 text-right">
                      {editingStudentId === student.id ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditSave(student.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-green-700 transition-all shadow-sm"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3.5 py-2 text-[12px] font-medium text-gray-600 hover:bg-gray-50 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => startEditing(student)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-100 bg-white shadow-sm px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50 transition-all"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(student.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-100 bg-white shadow-sm px-3 py-1.5 text-[12px] font-medium text-red-500 hover:bg-red-50 hover:border-red-200 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
