import { useState } from "react";
import { ChevronDown, ChevronRight, Folder } from "lucide-react";

export function AcademicTree({ structure, selection, onSelect }) {
  const [expandedLevels, setExpandedLevels] = useState(() => new Set(["primaria", "secundaria"]));
  const [expandedGrades, setExpandedGrades] = useState(() => new Set([selection.gradeId]));

  function toggleLevel(id) {
    setExpandedLevels((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGrade(level, grade) {
    const section = grade.sections?.[0];
    const course = section?.courses?.[0];
    onSelect({
      levelId: level.id,
      gradeId: grade.id,
      sectionId: section?.id || "",
      courseId: course?.id || "",
    });
    setExpandedGrades((current) => {
      const next = new Set(current);
      if (next.has(grade.id)) next.delete(grade.id);
      else next.add(grade.id);
      return next;
    });
  }

  return (
    <nav
      className="h-[calc(100%-50px)] max-h-[720px] overflow-auto px-2 pb-5 pt-[10px] [scrollbar-color:#b8c6c1_transparent] [scrollbar-width:thin]"
      aria-label="Estructura académica"
    >
      {structure.map((level) => {
        const levelOpen = expandedLevels.has(level.id);
        return (
          <div key={level.id}>
            <button
              type="button"
              className={`grid h-9 w-full grid-cols-[16px_19px_1fr] items-center gap-[7px] rounded px-[6px] py-[5px] text-left text-[11px] font-bold text-[#303b37] hover:text-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700/30 ${
                selection.levelId === level.id ? "text-brand-900" : ""
              }`}
              aria-expanded={levelOpen}
              onClick={() => toggleLevel(level.id)}
            >
              {levelOpen ? <ChevronDown className="h-[14px] w-[14px]" /> : <ChevronRight className="h-[14px] w-[14px]" />}
              <Folder className="h-[17px] w-[17px] text-[#4b5853]" />
              <span className="truncate">{level.name}</span>
            </button>
            {levelOpen ? (
              <div className="ml-[14px] border-l border-dotted border-[#bbc6c2] pl-[7px]">
                {level.grades.map((grade) => {
                  const gradeOpen = expandedGrades.has(grade.id);
                  return (
                    <div key={grade.id}>
                      <button
                        type="button"
                        className={`grid min-h-[34px] w-full grid-cols-[16px_1fr] items-center gap-[5px] rounded px-[5px] py-[4px] text-left text-[10px] text-[#303b37] hover:font-bold hover:text-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700/30 ${
                          selection.gradeId === grade.id ? "font-bold text-brand-900" : ""
                        }`}
                        aria-expanded={gradeOpen}
                        onClick={() => toggleGrade(level, grade)}
                      >
                        {gradeOpen ? <ChevronDown className="h-[13px] w-[13px]" /> : <ChevronRight className="h-[13px] w-[13px]" />}
                        <span className="truncate">{grade.name}</span>
                      </button>
                      {gradeOpen ? (
                        <div className="mb-1 ml-[13px] border-l border-dotted border-[#c8d1ce] pl-[6px]">
                          {grade.sections.flatMap((section) =>
                            section.courses.map((course) => {
                              const selected =
                                selection.sectionId === section.id && selection.courseId === course.id;
                              return (
                                <button
                                  type="button"
                                  key={`${section.id}-${course.id}`}
                                  className={`flex min-h-[32px] w-full items-center gap-[5px] rounded py-[5px] pl-[22px] pr-2 text-left text-[10px] leading-[1.25] text-[#53605b] hover:bg-brand-50 hover:text-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700/30 ${
                                    selected
                                      ? "bg-[#e0f0ea] font-bold text-brand-800 shadow-[inset_3px_0_0_0_var(--color-brand-700)]"
                                      : ""
                                  }`}
                                  aria-current={selected ? "page" : undefined}
                                  onClick={() =>
                                    onSelect({
                                      levelId: level.id,
                                      gradeId: grade.id,
                                      sectionId: section.id,
                                      courseId: course.id,
                                    })
                                  }
                                >
                                  <span>{section.name}</span>
                                  <i aria-hidden="true" className="not-italic text-[#83908b]">·</i>
                                  <span className="truncate">{course.name}</span>
                                </button>
                              );
                            }),
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

export default AcademicTree;
