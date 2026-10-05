import React, { useEffect, useState } from 'react';
import {
  UserPlus,
  Mail,
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
  Pencil,
  Trash2,
  Users,
  CalendarDays,
  LoaderCircle,
  LogOut
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'https://intelliprep-rhx3.onrender.com') + '';

export default function StudentManagement() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: ''
  });

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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || 'Unable to load students.');
      }

      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message
      });
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

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
      const token = getToken();

      const response = await fetch(`${API_BASE}/api/admin/students`, {
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

      setFormData({
        fullName: '',
        email: '',
        password: ''
      });

      await fetchStudents();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (student) => {
    setEditingStudentId(student.id);
    setEditForm({
      fullName: student.fullName,
      email: student.email
    });
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName: editForm.fullName,
          email: editForm.email
        })
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to update student.');
      }

      setMessage({
        type: 'success',
        text: data?.message || 'Student updated successfully.'
      });

      setEditingStudentId(null);
      setEditForm({ fullName: '', email: '' });
      await fetchStudents();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message
      });
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Are you sure you want to delete this student?');
    if (!confirmed) {
      return;
    }

    const token = getToken();

    try {
      const response = await fetch(`${API_BASE}/api/admin/students/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to delete student.');
      }

      setMessage({
        type: 'success',
        text: data?.message || 'Student deleted successfully.'
      });

      await fetchStudents();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message
      });
    }
  };

  const newestStudent = students.length > 0 ? students[0] : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[26px] font-bold text-gray-900 tracking-tight leading-none">
            Student Management
          </h1>
          <p className="text-[13px] text-gray-400 mt-1.5">
            Add, edit, and manage IntelliPrep student accounts.
          </p>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Total Students */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              Total Students
            </p>
            <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center">
              <Users className="h-4 w-4 text-orange-500" />
            </div>
          </div>
          <p className="text-[36px] font-bold text-gray-900 leading-none">{students.length}</p>
        </div>

        {/* Active Accounts */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              Active Accounts
            </p>
            <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
              <User className="h-4 w-4 text-gray-500" />
            </div>
          </div>
          <p className="text-[36px] font-bold text-gray-900 leading-none">{students.length}</p>
        </div>

        {/* Newest Student */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              Newest Student
            </p>
            <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-gray-500" />
            </div>
          </div>
          <p className="text-[16px] font-bold text-gray-900 leading-tight truncate">
            {newestStudent ? newestStudent.fullName : 'No students yet'}
          </p>
        </div>
      </div>

      {/* ── Create Student Form Card ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center">
            <UserPlus size={15} className="text-orange-600" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-gray-900">Create New Student</h2>
            <p className="text-[11px] text-gray-400">Fill in the details to add a new student account.</p>
          </div>
        </div>

        <div className="p-6">
          {/* Alert banner */}
          {message && (
            <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border ${
              message.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle2 size={16} className="mt-0.5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle size={16} className="mt-0.5 text-red-600 shrink-0" />
              )}
              <p className="text-[13px] font-medium leading-snug">{message.text}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5 uppercase tracking-wider" htmlFor="fullName">
                Full Name <span className="text-red-400 normal-case tracking-normal">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User size={14} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-[13px] text-gray-900 placeholder-gray-300 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all"
                  placeholder="e.g. Amal Perera"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5 uppercase tracking-wider" htmlFor="email">
                Email Address <span className="text-red-400 normal-case tracking-normal">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail size={14} className="text-gray-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-[13px] text-gray-900 placeholder-gray-300 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all"
                  placeholder="student@school.lk"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5 uppercase tracking-wider" htmlFor="password">
                Password{' '}
                <span className="text-gray-400 normal-case tracking-normal font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={14} className="text-gray-400" />
                </div>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-[13px] text-gray-900 placeholder-gray-300 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all"
                  placeholder="Leave blank to auto-generate"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-orange-600 hover:bg-orange-700 shadow-sm shadow-orange-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
              >
                {loading ? (
                  <>
                    <LoaderCircle size={14} className="animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <UserPlus size={14} />
                    Create Student
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Student Directory Table ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-semibold text-gray-900">Student Directory</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">{students.length} registered students</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loadingStudents ? (
            <div className="flex items-center justify-center gap-2.5 py-16 text-gray-400">
              <LoaderCircle className="h-5 w-5 animate-spin text-orange-500" />
              <span className="text-[13px]">Loading students…</span>
            </div>
          ) : students.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center">
                <Users size={20} className="text-orange-400" />
              </div>
              <p className="text-[14px] font-semibold text-gray-700">No students yet</p>
              <p className="text-[12px] text-gray-400 mt-1">Create your first student account above.</p>
            </div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Student ID
                  </th>
                  <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Full Name
                  </th>
                  <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Created At
                  </th>
                  <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors group">
                    {/* ID */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-[11px] font-mono font-semibold text-gray-500">
                        #{student.id}
                      </span>
                    </td>

                    {/* Full Name */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingStudentId === student.id ? (
                        <input
                          type="text"
                          value={editForm.fullName}
                          onChange={(e) => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] text-gray-900 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all"
                        />
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-white">
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingStudentId === student.id ? (
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] text-gray-900 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all"
                        />
                      ) : (
                        <span className="text-[13px] text-gray-500">{student.email}</span>
                      )}
                    </td>

                    {/* Created At */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-[12px] text-gray-400">
                        {new Date(student.createdAt).toLocaleString()}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {editingStudentId === student.id ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditSave(student.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700 transition-all"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-50 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => startEditing(student)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:border-orange-200 hover:text-orange-700 hover:bg-orange-50 transition-all"
                          >
                            <Pencil size={12} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(student.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-100 hover:border-red-200 transition-all"
                          >
                            <Trash2 size={12} />
                            Delete
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
