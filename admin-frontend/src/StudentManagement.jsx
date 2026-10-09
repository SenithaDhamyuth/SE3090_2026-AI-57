import React, { useEffect, useState } from 'react';
import {
  UserPlus, Mail, User, AlertCircle, CheckCircle2,
  Pencil, Trash2, Users, CalendarDays, LoaderCircle,
  X, Phone, MapPin, School, Search, RefreshCw, Eye, EyeOff
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
  const [showInitialPassword, setShowInitialPassword] = useState(false);

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
                {' '}This account is created on <strong>{new URL(API_BASE).host}</strong>; the student app must use the same API.
              </p>
            </div>

            {/* Initial Password */}
            <div>
              <label className="block text-[10px] tracking-wider font-semibold text-gray-400 mb-1.5 uppercase" htmlFor="modal-initialPassword">
                Initial Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showInitialPassword ? 'text' : 'password'}
                  id="modal-initialPassword"
                  name="initialPassword"
                  required
                  minLength={6}
                  maxLength={72}
                  autoComplete="new-password"
                  value={formData.initialPassword}
                  onChange={handleChange}
                  className={`block w-full rounded-xl border bg-gray-50/50 px-4 py-2.5 pr-11 text-[13px] text-gray-900 outline-none transition-all placeholder-gray-400 focus:ring-2 ${
                    passwordError
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-gray-200 focus:border-orange-500 focus:ring-orange-500/20'
                  }`}
                  placeholder="At least 6 chars + special char"
                />
                <button
                  type="button"
                  onClick={() => setShowInitialPassword(value => !value)}
                  aria-label={showInitialPassword ? 'Hide initial password' : 'Show initial password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 transition hover:text-gray-700"
                >
                  {showInitialPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
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
  const [editForm, setEditForm] = useState({ fullName: '', phoneNumber: '', address: '', college: '' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
    setEditForm({
      fullName: student.fullName || '',
      phoneNumber: student.phoneNumber || '',
      address: student.address || '',
      college: student.college || '',
    });
  };

  const cancelEditing = () => {
    setEditingStudentId(null);
    setEditForm({ fullName: '', phoneNumber: '', address: '', college: '' });
  };

  const handleEditSave = async (id) => {
    const token = getToken();
    if (editForm.phoneNumber.trim() && !PHONE_REGEX.test(editForm.phoneNumber.trim())) {
      setMessage({ type: 'error', text: 'Enter a valid phone number (7–20 digits, spaces, +, hyphens, or parentheses).' });
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/admin/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          fullName: editForm.fullName,
          phoneNumber: editForm.phoneNumber,
          address: editForm.address,
          college: editForm.college,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || 'Failed to update student.');
      setMessage({ type: 'success', text: data?.message || 'Student updated successfully.' });
      setEditingStudentId(null);
      setEditForm({ fullName: '', phoneNumber: '', address: '', college: '' });
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
  const filteredStudents = students.filter(student => [
    student.fullName,
    student.email,
    student.phoneNumber,
    student.address,
    student.college,
    student.id,
  ].some(value => String(value ?? '').toLowerCase().includes(searchQuery.trim().toLowerCase())));

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

      {/* ── Student Directory ── */}
      <section className="space-y-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Student Directory</h2>
            <p className="mt-1 text-sm text-gray-500">{filteredStudents.length} of {students.length} registered students</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="relative block w-full sm:w-80">
              <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search name, email, phone, address…"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
              />
            </label>
            <button type="button" onClick={fetchStudents} disabled={loadingStudents} aria-label="Refresh students" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw size={16} className={loadingStudents ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {loadingStudents ? (
          <div className="flex min-h-56 items-center justify-center gap-3 rounded-3xl border border-gray-200 bg-white text-gray-500">
            <LoaderCircle className="h-6 w-6 animate-spin text-orange-500" />
            <span className="text-sm font-medium">Loading students…</span>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-white px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
              <Users size={24} />
            </div>
            <h3 className="mt-4 text-lg font-bold text-gray-900">{students.length ? 'No matching students' : 'No students yet'}</h3>
            <p className="mt-1 max-w-md text-sm text-gray-500">
              {students.length ? 'Try a different name, email, phone number, address, or college.' : 'Add a student to start building your directory.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filteredStudents.map(student => {
              const isEditing = editingStudentId === student.id;
              return (
                <article key={student.id} className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="flex items-start gap-4 bg-gradient-to-r from-orange-50/80 via-white to-amber-50/60 p-5">
                    <StudentAvatar student={student} size={12} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <input
                              type="text"
                              aria-label="Student name"
                              value={editForm.fullName}
                              onChange={event => setEditForm(prev => ({ ...prev, fullName: event.target.value }))}
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                            />
                          ) : (
                            <h3 className="truncate text-lg font-bold text-gray-900">{student.fullName || 'Unnamed student'}</h3>
                          )}
                          <p className="mt-1 font-mono text-xs font-semibold text-orange-700">Student #{student.id}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {isEditing ? (
                            <>
                              <button type="button" onClick={() => handleEditSave(student.id)} className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700">Save</button>
                              <button type="button" onClick={cancelEditing} className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50">Cancel</button>
                            </>
                          ) : (
                            <>
                              <button type="button" onClick={() => startEditing(student)} aria-label={`Edit ${student.fullName}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700">
                                <Pencil size={15} />
                              </button>
                              <button type="button" onClick={() => handleDelete(student.id)} aria-label={`Delete ${student.fullName}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 p-5 sm:grid-cols-2">
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl bg-sky-50/80 p-3.5">
                      <Mail size={17} className="mt-0.5 shrink-0 text-sky-700" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">Email address</p>
                        <p className="mt-1 break-all text-sm font-medium text-slate-800">{student.email || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl bg-emerald-50/80 p-3.5">
                      <Phone size={17} className="mt-0.5 shrink-0 text-emerald-700" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Phone number</p>
                        {isEditing ? (
                          <input type="tel" aria-label="Phone number" value={editForm.phoneNumber} onChange={event => setEditForm(prev => ({ ...prev, phoneNumber: event.target.value }))} className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-emerald-200" />
                        ) : (
                          student.phoneNumber
                            ? <a href={`tel:${student.phoneNumber}`} className="mt-1 block break-words text-sm font-medium text-slate-800 hover:text-emerald-700">{student.phoneNumber}</a>
                            : <p className="mt-1 text-sm text-slate-400">Not provided</p>
                        )}
                      </div>
                    </div>
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl bg-violet-50/80 p-3.5">
                      <MapPin size={17} className="mt-0.5 shrink-0 text-violet-700" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Address</p>
                        {isEditing ? (
                          <textarea aria-label="Address" rows={2} value={editForm.address} onChange={event => setEditForm(prev => ({ ...prev, address: event.target.value }))} className="mt-1 w-full resize-y rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-violet-200" />
                        ) : (
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium text-slate-800">{student.address || <span className="font-normal text-slate-400">Not provided</span>}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl bg-amber-50/80 p-3.5">
                      <School size={17} className="mt-0.5 shrink-0 text-amber-700" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">College</p>
                        {isEditing ? (
                          <input type="text" aria-label="College" value={editForm.college} onChange={event => setEditForm(prev => ({ ...prev, college: event.target.value }))} className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-amber-200" />
                        ) : (
                          <p className="mt-1 break-words text-sm font-medium text-slate-800">{student.college || <span className="font-normal text-slate-400">Not provided</span>}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
                    <CalendarDays size={14} className="text-gray-400" />
                    <span>Registered</span>
                    <span className="font-semibold text-gray-700">{student.createdAt ? new Date(student.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Date unavailable'}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
