import { selector, selectorFamily } from "recoil";

import * as utils from "./utils";
import * as booleanField from "./BooleanFieldFilter.state";
import * as numericField from "./NumericFieldFilter.state";
import * as stringField from "./StringFieldFilter.state";
import * as atoms from "../../recoil/atoms";
import * as filterAtoms from "./atoms";
import * as selectors from "../../recoil/selectors";
import {
  LABEL_LIST,
  RESERVED_FIELDS,
  VALID_LIST_TYPES,
} from "../../utils/labels";

interface Label {
  confidence?: number;
  label?: number;
}

export type LabelFilters = {
  [key: string]: (label: Label) => boolean;
};

export const getPathExtension = (type: string): string => {
  if (VALID_LIST_TYPES.includes(type)) {
    return `.${LABEL_LIST[type]}`;
  }
  return "";
};

export const labelFilters = selectorFamily<LabelFilters, boolean>({
  key: "labelFilters",
  get: (modal) => ({ get }) => {
    const labels = get(utils.activeFields(true));
    const filters = {};
    const typeMap = get(selectors.labelTypesMap);
    const hiddenLabels = modal ? get(atoms.hiddenLabels) : null;
    for (const field of labels) {
      const path = `${field}${getPathExtension(typeMap[field])}`;

      const cPath = `${path}.confidence`;
      const lPath = `${path}.label`;

      const [cRange, cNone, lValues, lExclude] = [
        get(
          numericField.rangeAtom({ modal, path: cPath, defaultRange: [0, 1] })
        ),
        get(
          numericField.noneAtom({ modal, path: cPath, defaultRange: [0, 1] })
        ),
        get(stringField.selectedValuesAtom({ modal, path: lPath })),
        get(stringField.excludeAtom({ modal, path: lPath })),
      ];

      const matchedTags = get(filterAtoms.matchedTags({ key: "label", modal }));

      filters[field] = (s) => {
        if (hiddenLabels && hiddenLabels[s.id ?? s._id]) {
          return false;
        }
        const inRange =
          cRange[0] - 0.005 <= s.confidence &&
          s.confidence <= cRange[1] + 0.005;
        const noConfidence = cNone && s.confidence === undefined;
        let label = s.label ? s.label : s.value;
        if (label === undefined) {
          label = null;
        }
        let included = lValues.includes(label);
        if (lExclude) {
          included = !included;
        }

        const meetsTags =
          matchedTags.size == 0 ||
          (s.tags && s.tags.some((t) => matchedTags.has(t)));

        return (
          (inRange || noConfidence) &&
          (included || lValues.length === 0) &&
          meetsTags
        );
      };
    }
    return filters;
  },
  set: () => ({ get, set }, _) => {
    set(utils.activeFields(true), get(utils.activeFields(false)));
    set(atoms.cropToContent(true), get(atoms.cropToContent(false)));
    set(filterAtoms.modalFilterStages, get(filterAtoms.filterStages));
    set(atoms.colorByLabel(true), get(atoms.colorByLabel(false)));
    set(atoms.colorSeed(true), get(atoms.colorSeed(false)));
    set(atoms.sortFilterResults(true), get(atoms.sortFilterResults(false)));
  },
});

export const sampleModalFilter = selector({
  key: "sampleModalFilter",
  get: ({ get }) => {
    const filters = get(labelFilters(true));

    const labels = get(utils.activeFields(true));
    const hiddenLabels = get(atoms.hiddenLabels);
    const fields = get(utils.activeFields(false));
    return (sample, prefix = null, allFields = false, withPrefix = true) => {
      return Object.entries(sample).reduce((acc, [key, value]) => {
        if (value && hiddenLabels[value.id ?? value._id]) {
          return acc;
        }
        let addKey = key;
        if (prefix) {
          key = `${prefix}${key}`;
          withPrefix && (addKey = key);
        }
        if (key === "tags") {
          acc[addKey] = value;
        } else if (
          value &&
          VALID_LIST_TYPES.includes(value._cls) &&
          (labels.includes(key) || allFields)
        ) {
          if (allFields || fields.includes(key)) {
            acc[addKey] =
              filters[key] && value !== null
                ? {
                    ...value,
                    [value._cls.toLowerCase()]: value[
                      value._cls.toLowerCase()
                    ].filter(
                      (l) => filters[key](l) && !hiddenLabels[l.id ?? l._id]
                    ),
                  }
                : value;
          }
        } else if (
          value !== null &&
          filters[addKey] &&
          filters[addKey](value) &&
          (labels.includes(key) || allFields)
        ) {
          acc[addKey] = value;
        } else if (RESERVED_FIELDS.includes(key)) {
          acc[addKey] = value;
        } else if (["string", "number", "null"].includes(typeof value)) {
          acc[addKey] = value;
        }
        return acc;
      }, {});
    };
  },
});

export const fieldIsFiltered = selectorFamily<
  boolean,
  { path: string; modal: boolean }
>({
  key: "fieldIsFiltered",
  get: ({ path, modal }) => ({ get }) => {
    const isArgs = { path, modal };
    if (get(booleanField.isBooleanField(path))) {
      return get(booleanField.fieldIsFiltered(isArgs));
    } else if (get(numericField.isNumericField(path))) {
      return get(numericField.fieldIsFiltered(isArgs));
    } else if (get(stringField.isStringField(path))) {
      return get(stringField.fieldIsFiltered(isArgs));
    }
    if (path.startsWith("_label_tags.")) {
      return get(filterAtoms.matchedTags({ modal, key: "label" })).has(
        path.slice("_label_tags.".length)
      );
    }

    if (path.startsWith("tags.")) {
      return get(filterAtoms.matchedTags({ modal, key: "sample" })).has(
        path.slice("tags.".length)
      );
    }

    path = `${path}${getPathExtension(get(selectors.labelTypesMap)[path])}`;
    const cPath = `${path}.confidence`;
    const lPath = `${path}.label`;
    const hasHiddenLabels = modal
      ? get(selectors.hiddenFieldLabels(path.split(".")[0])).length > 0
      : false;

    return (
      get(
        numericField.fieldIsFiltered({
          ...isArgs,
          path: cPath,
          defaultRange: [0, 1],
        })
      ) ||
      get(stringField.fieldIsFiltered({ ...isArgs, path: lPath })) ||
      hasHiddenLabels
    );
  },
});

export const isLabelField = selectorFamily<boolean, string>({
  key: "isLabelField",
  get: (field) => ({ get }) => {
    const names = get(selectors.labelNames("sample")).concat(
      get(selectors.labelNames("frame")).map((l) => "frames." + l)
    );
    return names.includes(field);
  },
});
