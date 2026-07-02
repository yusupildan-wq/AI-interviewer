import type {
  CodingLanguage,
  SeniorityLevel,
  TargetRole,
  UpdateUserProfileRequest,
  UserProfile,
} from '@ai-interviewer/shared';
import { Loader2, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ApiError, getProfile, updateProfile } from '../../lib/api';

const TARGET_ROLES: { value: TargetRole; label: string }[] = [
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'full-stack', label: 'Full-stack' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'ml-ai', label: 'ML / AI' },
  { value: 'data', label: 'Data' },
  { value: 'devops', label: 'DevOps' },
  { value: 'security', label: 'Security' },
];

const SENIORITY: { value: SeniorityLevel; label: string }[] = [
  { value: 'intern', label: 'Intern' },
  { value: 'new-grad', label: 'New grad' },
  { value: 'mid-level', label: 'Mid-level' },
  { value: 'senior', label: 'Senior' },
  { value: 'staff', label: 'Staff' },
];

const LANGUAGES: { value: CodingLanguage; label: string }[] = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
];

const splitList = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const joinList = (items: string[]): string => items.join(', ');

const profileToForm = (profile: UserProfile) => ({
  targetRole: profile.targetRole,
  seniority: profile.seniority,
  preferredLanguage: profile.preferredLanguage,
  targetCompanies: joinList(profile.targetCompanies),
  weakAreas: joinList(profile.weakAreas),
  interviewGoal: profile.interviewGoal,
});

type ProfileForm = ReturnType<typeof profileToForm>;

const selectClass =
  'mt-2 w-full rounded-md border border-white/10 bg-surface px-3 py-3 text-sm text-ink outline-none transition focus:border-signal';

const inputClass =
  'mt-2 w-full rounded-md border border-white/10 bg-surface px-3 py-3 text-sm text-ink placeholder:text-graphite outline-none transition focus:border-signal';

export const ProfilePage = () => {
  const [profile, setProfile] = useState<UserProfile>();
  const [form, setForm] = useState<ProfileForm>();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [savedAt, setSavedAt] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    getProfile()
      .then((loaded) => {
        if (cancelled) return;
        setProfile(loaded);
        setForm(profileToForm(loaded));
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Could not load your profile.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasChanges = useMemo(() => {
    if (!profile || !form) return false;
    const original = profileToForm(profile);
    return JSON.stringify(original) !== JSON.stringify(form);
  }, [form, profile]);

  const updateForm = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleSave = async () => {
    if (!form || isSaving) return;
    setIsSaving(true);
    setError(undefined);
    setSavedAt(undefined);

    const body: UpdateUserProfileRequest = {
      targetRole: form.targetRole,
      seniority: form.seniority,
      preferredLanguage: form.preferredLanguage,
      targetCompanies: splitList(form.targetCompanies),
      weakAreas: splitList(form.weakAreas),
      interviewGoal: form.interviewGoal,
    };

    try {
      const saved = await updateProfile(body);
      setProfile(saved);
      setForm(profileToForm(saved));
      setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save your profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!form) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center px-4 text-graphite">
        <Loader2 className="animate-spin" size={20} aria-hidden="true" />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="border-b border-white/10 pb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-signal">Profile</p>
        <h1 className="mt-3 text-4xl font-bold text-ink">Interview target</h1>
        <p className="mt-4 max-w-2xl leading-7 text-graphite">
          These settings shape interview selection, Alex's calibration, and your dashboard
          recommendations.
        </p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <label className="text-sm font-semibold text-ink">
          Target role
          <select
            value={form.targetRole}
            onChange={(event) => updateForm('targetRole', event.target.value as TargetRole)}
            className={selectClass}
          >
            {TARGET_ROLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-ink">
          Seniority
          <select
            value={form.seniority}
            onChange={(event) => updateForm('seniority', event.target.value as SeniorityLevel)}
            className={selectClass}
          >
            {SENIORITY.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-ink">
          Preferred language
          <select
            value={form.preferredLanguage}
            onChange={(event) =>
              updateForm('preferredLanguage', event.target.value as CodingLanguage)
            }
            className={selectClass}
          >
            {LANGUAGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <label className="text-sm font-semibold text-ink">
          Target companies
          <input
            value={form.targetCompanies}
            onChange={(event) => updateForm('targetCompanies', event.target.value)}
            placeholder="Google, Meta, Amazon"
            className={inputClass}
          />
        </label>

        <label className="text-sm font-semibold text-ink">
          Weak areas
          <input
            value={form.weakAreas}
            onChange={(event) => updateForm('weakAreas', event.target.value)}
            placeholder="graphs, system design, behavioral stories"
            className={inputClass}
          />
        </label>
      </div>

      <label className="mt-6 block text-sm font-semibold text-ink">
        Interview goal
        <textarea
          value={form.interviewGoal}
          onChange={(event) => updateForm('interviewGoal', event.target.value)}
          rows={4}
          className={`${inputClass} resize-none leading-6`}
        />
      </label>

      {error && <p className="mt-5 text-sm font-medium text-red-400">{error}</p>}
      {savedAt && <p className="mt-5 text-sm font-medium text-signal">Saved at {savedAt}</p>}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={!hasChanges || isSaving}
        className="mt-8 inline-flex items-center gap-2 rounded-md bg-signal px-5 py-3 text-sm font-semibold text-canvas shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? (
          <Loader2 className="animate-spin" size={16} aria-hidden="true" />
        ) : (
          <Save size={16} />
        )}
        Save profile
      </button>
    </section>
  );
};
