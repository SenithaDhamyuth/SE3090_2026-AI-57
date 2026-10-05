import React, { useEffect, useState } from 'react';
import {
  UserPlus, Mail, User, AlertCircle, CheckCircle2,
  Pencil, Trash2, Users, CalendarDays, LoaderCircle
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'https://intelliprep-rhx3.onrender.com') + '';

export default function StudentManagement() {
  const [formData, setFormData] = useState({ fullName: '', email: '' });
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [editForm, setEditForm] = useState({ fullName: '', email: '' });

  const getToken = () => localStorage.getItem('admin_token') || '';

  const fetchStudents = async () => {
    const token = getToken();
    try {
      setLoadingStudents(true);
      const response = await fetch(`${API_BASE}/api/admin/students`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
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

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/admin/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || 'Failed to create student. Please try again.');

      setMessage({
        type: 'success',
        text: 'Student created and welcome email sent!'
      });
      setFormData({ fullName: '', email: '' });
      await fetchStudents();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

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
        body: JSON.stringify({ fullName: editForm.fullName, email: editForm.email })
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
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
      {/* ── Page Header ── */}
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Student Management</h1>
        <p className="text-[13px] text-gray-500 mt-1">Add, edit, and manage IntelliPrep student accounts.</p>
      </div>

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

      {/* ── Create Student Form Card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-100 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <UserPlus size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Create New Student</h2>
            <p className="text-[13px] text-gray-500 mt-0.5">Fill in the details to add a new student account.</p>
          </div>
        </div>

        <div className="p-8">
          {message && (
            <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border ${
              message.type === 'success'
                ? 'bg-green-50 border-green-100 text-green-800'
                : 'bg-red-50 border-red-100 text-red-800'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle2 size={18} className="mt-0.5 text-green-600 shrink-0" />
              ) : (
                <AlertCircle size={18} className="mt-0.5 text-red-600 shrink-0" />
              )}
              <p className="text-[13px] font-medium leading-snug">{message.text}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[10px] tracking-wider font-semibold text-gray-400 mb-2 uppercase" htmlFor="fullName">
                Full Name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User size={16} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                  className="block w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-[13px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all bg-gray-50/50"
                  placeholder="e.g. Amal Perera"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] tracking-wider font-semibold text-gray-400 mb-2 uppercase" htmlFor="email">
                Email Address <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail size={16} className="text-gray-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-[13px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all bg-gray-50/50"
                  placeholder="admin@intelliprep.com"
                />
              </div>
            </div>


            {/* Auto-generated password notice */}
            <div className="flex items-start gap-3 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-orange-500"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-[12px] text-orange-700 leading-relaxed">
                A <strong>secure temporary password</strong> will be auto-generated and sent directly to the student's email address. The student can change it from their Profile screen.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[13px] font-semibold text-white bg-orange-600 hover:bg-orange-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <LoaderCircle size={16} className="animate-spin" /> : <UserPlus size={16} />}
                {loading ? 'Creating...' : 'Create Student'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Student Directory Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden pb-4">
        <div className="px-8 py-6">
          <h2 className="text-base font-bold text-gray-900">Student Directory</h2>
          <p className="text-[13px] text-gray-500 mt-1">{students.length} registered students</p>
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
              <p className="text-[13px] text-gray-500 mt-1">Create your first student account above.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="py-3 pr-4 text-[10px] tracking-wider text-gray-400 uppercase font-semibold border-b border-gray-100">Student ID</th>
                  <th className="px-4 py-3 text-[10px] tracking-wider text-gray-400 uppercase font-semibold border-b border-gray-100">Full Name</th>
                  <th className="px-4 py-3 text-[10px] tracking-wider text-gray-400 uppercase font-semibold border-b border-gray-100">Email</th>
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

                    {/* Full Name */}
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
                          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shrink-0 shadow-sm">
                            <span className="text-[11px] font-bold text-white">
                              {student.fullName?.[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <span className="text-[13px] font-semibold text-gray-900">
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

                    {/* Created At */}
                    <td className="px-4 py-5">
                      <span className="text-[12px] text-gray-400">
                        {new Date(student.createdAt).toLocaleString()}
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
