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

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    window.location.href = '/login';
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Student Management</h1>
          <p className="text-zinc-500 mt-1 text-sm">Add and manage students for IntelliPrep.</p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 hover:border-red-300"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-500">Total Students</span>
            <Users className="h-5 w-5 text-orange-500" />
          </div>
          <div className="mt-4 text-3xl font-bold text-zinc-900">{students.length}</div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-500">Active Accounts</span>
            <User className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="mt-4 text-3xl font-bold text-zinc-900">{students.length}</div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-500">Newest Student</span>
            <CalendarDays className="h-5 w-5 text-sky-500" />
          </div>
          <div className="mt-4 text-lg font-semibold text-zinc-900 truncate">
            {newestStudent ? newestStudent.fullName : 'No students yet'}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200/80 shadow-sm overflow-hidden mb-8">
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

      <div className="bg-white rounded-xl border border-zinc-200/80 shadow-sm overflow-hidden">
        <div className="p-5 md:p-6 border-b border-zinc-100 bg-zinc-50/50">
          <h2 className="text-lg font-semibold text-zinc-800">Student Directory</h2>
        </div>

        <div className="overflow-x-auto">
          {loadingStudents ? (
            <div className="flex items-center justify-center gap-2 py-12 text-zinc-500">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              Loading students...
            </div>
          ) : students.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">No students found.</div>
          ) : (
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Student ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Full Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Created At</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-700">
                      # {student.id}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-900">
                      {editingStudentId === student.id ? (
                        <input
                          type="text"
                          value={editForm.fullName}
                          onChange={(e) => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      ) : (
                        student.fullName
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-700">
                      {editingStudentId === student.id ? (
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      ) : (
                        student.email
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600">
                      {new Date(student.createdAt).toLocaleString()}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {editingStudentId === student.id ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditSave(student.id)}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-100"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEditing(student)}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-100"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(student.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-red-700 hover:bg-red-100"
                          >
                            <Trash2 size={14} />
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
