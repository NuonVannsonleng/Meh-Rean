import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { t } from "../i18n/en";
import {
  loadInstitutions,
  searchInstitutions,
  type Institution,
  type InstitutionData,
  type InstitutionSelection,
} from "../lib/institutions";
import { INSTITUTION_KINDS, type InstitutionKind } from "../types";
import { describedBy, FieldShell, TextField } from "./FormField";
import { ChevronDownIcon, CloseIcon, GraduationIcon, SearchIcon } from "./Icons";
import InstitutionLogo from "./InstitutionLogo";
import RadioGroup from "./RadioGroup";

interface ManualFormProps {
  countries: string[];
  onBack: () => void;
  onDone: (selection: InstitutionSelection) => void;
}

/** The path for high schools: the list covers universities only. */
function ManualForm({ countries, onBack, onDone }: ManualFormProps) {
  const countryId = useId();
  const kindName = useId();
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [kind, setKind] = useState<InstitutionKind>("high-school");
  const [errors, setErrors] = useState<{ name?: string; country?: string }>({});

  const submit = () => {
    const found = {
      name: name.trim() ? undefined : t.institution.manualNameRequired,
      country: country.trim() ? undefined : t.institution.manualCountryRequired,
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    onDone({ name: name.trim(), domain: null, country: country.trim(), kind });
  };

  return (
    // A plain block, not a form: the picker itself sits inside the sign-up and
    // settings forms, and forms cannot be nested.
    <div className="space-y-5 px-4 py-4 sm:px-5">
      <TextField
        label={t.institution.manualNameLabel}
        value={name}
        onChange={(value) => {
          setName(value);
          setErrors((current) => ({ ...current, name: undefined }));
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          submit();
        }}
        placeholder={t.institution.manualNamePlaceholder}
        error={errors.name}
        autoFocus
      />
      {countries.length ? (
        <FieldShell id={countryId} label={t.institution.manualCountryLabel} error={errors.country}>
          <select
            id={countryId}
            value={country}
            onChange={(event) => {
              setCountry(event.target.value);
              setErrors((current) => ({ ...current, country: undefined }));
            }}
            aria-invalid={errors.country ? true : undefined}
            aria-describedby={describedBy(countryId, errors.country)}
            className="input cursor-pointer"
          >
            <option value="" disabled>
              {t.institution.manualCountryPlaceholder}
            </option>
            {countries.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </FieldShell>
      ) : (
        // The country list comes from the same file as the schools, so if that
        // download failed the country is typed in instead.
        <TextField
          label={t.institution.manualCountryLabel}
          value={country}
          onChange={(value) => {
            setCountry(value);
            setErrors((current) => ({ ...current, country: undefined }));
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            submit();
          }}
          placeholder={t.institution.manualCountryTypePlaceholder}
          autoComplete="country-name"
          error={errors.country}
        />
      )}
      <RadioGroup
        name={kindName}
        legend={t.institution.manualKindLabel}
        options={INSTITUTION_KINDS.map((value) => ({ value, label: t.institution.kinds[value] }))}
        value={kind}
        onChange={setKind}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onBack} className="btn-secondary">
          {t.institution.manualBack}
        </button>
        <button type="button" onClick={submit} className="btn-primary">
          {t.institution.manualSave}
        </button>
      </div>
    </div>
  );
}

interface DialogProps {
  onClose: () => void;
  onSelect: (selection: InstitutionSelection) => void;
}

function InstitutionDialog({ onClose, onSelect }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const [data, setData] = useState<InstitutionData | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    inputRef.current?.focus();

    let live = true;
    loadInstitutions()
      .then((loaded) => live && setData(loaded))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const trimmed = query.trim();
  const { matches, total } = useMemo(
    () => (data && trimmed ? searchInstitutions(data, trimmed) : { matches: [], total: 0 }),
    [data, trimmed],
  );

  useEffect(() => setActive(0), [trimmed]);

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const choose = (selection: InstitutionSelection) => {
    onSelect(selection);
    dialogRef.current?.close();
  };

  const pick = (institution: Institution) =>
    choose({
      name: institution.name,
      domain: institution.domain,
      country: institution.country,
      kind: "university",
    });

  // The "not listed" row sits after the matches, so it is always reachable.
  const optionCount = matches.length + 1;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter always stops here: the picker is used inside the sign-up and
    // settings forms, which must not submit from the dialog.
    if (event.key === "Enter") {
      event.preventDefault();
      if (!data) return;
      const institution = matches[active];
      if (institution) pick(institution);
      else setManual(true);
      return;
    }
    if (!data) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % optionCount);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + optionCount) % optionCount);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label={t.institution.dialogTitle}
      className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 backdrop:bg-ink-900/25 backdrop:backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
    >
      <div className="bg-surface animate-page flex h-full flex-col pt-[env(safe-area-inset-top)] sm:mx-auto sm:mt-16 sm:h-auto sm:max-h-[min(38rem,calc(100dvh-6rem))] sm:w-[min(36rem,calc(100vw-2rem))] sm:rounded-2xl sm:border sm:border-line sm:pt-0 sm:shadow-2xl [@media(max-height:500px)]:sm:mt-3 [@media(max-height:500px)]:sm:max-h-[calc(100dvh-1.5rem)]">
        <div className="border-line flex shrink-0 items-center gap-2 border-b px-3 py-2.5 sm:px-4">
          {manual ? (
            <h2 className="text-ink-900 flex-1 truncate text-base font-semibold">{t.institution.manualTitle}</h2>
          ) : (
            <>
              <SearchIcon className="text-ink-400 h-5 w-5" />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded={data !== null}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={data ? `${listId}-${active}` : undefined}
                aria-label={t.institution.searchLabel}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t.institution.searchPlaceholder}
                autoComplete="off"
                enterKeyHint="search"
                className="text-ink-900 placeholder:text-ink-400 h-10 min-w-0 flex-1 bg-transparent text-base outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={t.institution.clear}
                  className="icon-btn animate-pop h-8 w-8"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={t.institution.close}
            className="text-ink-700 hover:bg-surface-hover press rounded-lg px-2.5 py-1.5 text-sm font-medium"
          >
            <span aria-hidden="true" className="sm:hidden">
              {t.common.cancel}
            </span>
            <kbd aria-hidden="true" className="border-line text-ink-500 hidden rounded-md border px-1.5 py-0.5 text-xs font-medium sm:inline">
              Esc
            </kbd>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {manual ? (
            <ManualForm countries={data?.countries ?? []} onBack={() => setManual(false)} onDone={choose} />
          ) : (
            <div className="px-2 pt-2 pb-3 sm:px-2.5">
              {failed && (
                <div className="px-3 py-4">
                  <p role="alert" className="text-ink-500 text-sm">
                    {t.institution.loadError}
                  </p>
                  {/* A school is required, so hand-entry stays open. */}
                  <button type="button" onClick={() => setManual(true)} className="btn-secondary mt-3">
                    {t.institution.notListed}
                  </button>
                </div>
              )}
              {!failed && !data && (
                <p role="status" className="text-ink-500 px-3 py-4 text-sm">
                  {t.institution.loading}
                </p>
              )}
              {data && (
                <>
                  {trimmed ? (
                    <p role="status" className="text-ink-500 px-3 pt-1 pb-2 text-xs">
                      {total ? t.institution.resultCount(matches.length, total) : t.institution.noResults(trimmed)}
                    </p>
                  ) : (
                    // A hint, not the whole empty state: high schools are not in
                    // the list at all, so manual entry stays one tap away below.
                    <p className="text-ink-500 px-3 pt-2 pb-3 text-sm">{t.institution.startTyping}</p>
                  )}
                  <ul id={listId} role="listbox" aria-label={t.institution.searchLabel} className="space-y-0.5">
                    {matches.map((institution, index) => (
                      <li key={`${institution.domain}-${institution.name}`} role="presentation">
                        <div
                          id={`${listId}-${index}`}
                          role="option"
                          aria-selected={index === active}
                          onPointerMove={() => setActive(index)}
                          onClick={() => pick(institution)}
                          style={{ animationDelay: `${Math.min(index, 8) * 18}ms` }}
                          className={`animate-fade flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors duration-100 ${
                            index === active ? "bg-surface-hover" : ""
                          }`}
                        >
                          <InstitutionLogo name={institution.name} domain={institution.domain} className="h-8 w-8" />
                          <span className="min-w-0">
                            <span className="text-ink-700 block truncate text-sm">{institution.name}</span>
                            <span className="text-ink-500 block truncate text-xs">{institution.country}</span>
                          </span>
                        </div>
                      </li>
                    ))}
                    <li role="presentation">
                      <div
                        id={`${listId}-${matches.length}`}
                        role="option"
                        aria-selected={active === matches.length}
                        onPointerMove={() => setActive(matches.length)}
                        onClick={() => setManual(true)}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors duration-100 ${
                          active === matches.length ? "bg-surface-hover" : ""
                        }`}
                      >
                        <span className="bg-brand-50 text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                          <GraduationIcon className="h-4.5 w-4.5" />
                        </span>
                        <span className="text-accent truncate text-sm font-semibold">{t.institution.notListed}</span>
                      </div>
                    </li>
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        {!manual && (
          <p className="border-line text-ink-400 hidden shrink-0 border-t px-4 py-2 text-xs sm:block [@media(max-height:500px)]:hidden">
            {t.institution.keyboardHint}
          </p>
        )}
      </div>
    </dialog>
  );
}

interface InstitutionPickerProps {
  label: string;
  value: InstitutionSelection | null;
  onChange: (value: InstitutionSelection) => void;
  hint?: string;
  error?: string;
  optional?: boolean;
}

/** Button + searchable dialog for choosing a school or university. */
export default function InstitutionPicker({ label, value, onChange, hint, error, optional }: InstitutionPickerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className="input flex cursor-pointer items-center gap-3 text-left"
      >
        {value ? (
          <>
            <InstitutionLogo name={value.name} domain={value.domain} className="h-7 w-7" />
            <span className="min-w-0 flex-1">
              <span className="text-ink-900 block truncate text-sm font-medium">{value.name}</span>
              {value.country && <span className="text-ink-500 block truncate text-xs">{value.country}</span>}
            </span>
          </>
        ) : (
          <>
            <GraduationIcon className="text-ink-400 h-5 w-5 shrink-0" />
            <span className="text-ink-400 min-w-0 flex-1 truncate">{t.institution.placeholder}</span>
          </>
        )}
        <ChevronDownIcon className="text-ink-400 h-4 w-4 shrink-0" />
      </button>
      {open && <InstitutionDialog onClose={() => setOpen(false)} onSelect={onChange} />}
    </FieldShell>
  );
}
