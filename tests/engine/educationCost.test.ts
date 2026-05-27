import { describe, expect, it } from 'vitest';
import { eduCostForChild } from '../../src/engine/educationCostEngine';
import { EDUCATION_COST, UNIVERSITY_ENTRANCE_FEE } from '../../src/engine/constants';
import { field } from '../../src/schema/field';
import type { ChildInput, SchoolPath, UniversityLiving, UniversityPath } from '../../src/schema/types';

// STEP11.10: 教育費の数値を R5 文科省「子供の学習費調査」と JASSO R4「学生生活調査」に整合させ、
// 私立小学校コースを追加し、大学入学金を 1 年目（age=18）に限り別途加算する。

function makeChild(args: {
  age: number;
  elementary?: SchoolPath;
  middle?: SchoolPath;
  high?: SchoolPath;
  uni?: UniversityPath;
  living?: UniversityLiving;
}): ChildInput {
  return {
    currentAge: field(args.age, 'user_input', '年齢', '', '歳'),
    ageAssumed: false,
    elementarySchool: field(args.elementary ?? 'public', 'user_input', '小学校', ''),
    middleSchool: field(args.middle ?? 'public', 'user_input', '中学', ''),
    highSchool: field(args.high ?? 'public', 'user_input', '高校', ''),
    university: field(args.uni ?? 'public_humanities', 'user_input', '大学', ''),
    uniLiving: field(args.living ?? 'home', 'user_input', '住まい', ''),
  };
}

describe('education cost: MEXT R5 alignment', () => {
  it('elementary 公立 ≒ 37万 (MEXT R5: 36.7), 私立 ≒ 174万 (MEXT R5: 174.2)', () => {
    expect(EDUCATION_COST.elementary.public).toBe(37);
    expect(EDUCATION_COST.elementary.private).toBe(174);
  });

  it('middle 公立 ≒ 54万 (MEXT R5: 54.2), 私立 ≒ 156万 (MEXT R5: 156)', () => {
    expect(EDUCATION_COST.middle.public).toBe(54);
    expect(EDUCATION_COST.middle.private).toBe(156);
  });

  it('high 公立 ≒ 60万 (MEXT R5: 59.7), 私立 ≒ 118万 (MEXT R5: 117.9)', () => {
    expect(EDUCATION_COST.high.public).toBe(60);
    expect(EDUCATION_COST.high.private).toBe(118);
  });

  it('private elementary cost is applied when child.elementarySchool === "private"', () => {
    const publicCost = eduCostForChild(makeChild({ age: 8, elementary: 'public' }), 8);
    const privateCost = eduCostForChild(makeChild({ age: 8, elementary: 'private' }), 8);
    expect(publicCost).toBe(37);
    expect(privateCost).toBe(174);
    expect(privateCost).toBeGreaterThan(publicCost);
  });
});

describe('university entrance fee (added only at age 18)', () => {
  it('age 18 = annual + entrance, age 19/20/21 = annual only', () => {
    const child = makeChild({ age: 18, uni: 'private_humanities', living: 'home' });
    const annual = EDUCATION_COST.university.private_humanities.home; // 150
    const entrance = UNIVERSITY_ENTRANCE_FEE.private_humanities; // 25
    expect(eduCostForChild(child, 18)).toBe(annual + entrance); // 175
    expect(eduCostForChild(child, 19)).toBe(annual); // 150
    expect(eduCostForChild(child, 20)).toBe(annual);
    expect(eduCostForChild(child, 21)).toBe(annual);
    expect(eduCostForChild(child, 22)).toBe(0); // 大学後は教育費なし
  });

  it('entrance fee is 0 for non-attending (uni = "none")', () => {
    const child = makeChild({ age: 18, uni: 'none', living: 'home' });
    expect(eduCostForChild(child, 18)).toBe(0);
    expect(eduCostForChild(child, 19)).toBe(0);
  });

  it('4-year total = sum of annuals + exactly one entrance fee', () => {
    const child = makeChild({ age: 18, uni: 'private_science', living: 'away' });
    const annual = EDUCATION_COST.university.private_science.away; // 255
    const entrance = UNIVERSITY_ENTRANCE_FEE.private_science; // 26
    const fourYearTotal = [18, 19, 20, 21].reduce((s, age) => s + eduCostForChild(child, age), 0);
    expect(fourYearTotal).toBe(annual * 4 + entrance);
  });

  it('national/public universities have a larger entrance fee than private ones (R5 source)', () => {
    // 国公立 28万 > 私立文系 25万 / 理系 26万
    expect(UNIVERSITY_ENTRANCE_FEE.public_humanities).toBeGreaterThan(UNIVERSITY_ENTRANCE_FEE.private_humanities);
    expect(UNIVERSITY_ENTRANCE_FEE.public_science).toBeGreaterThan(UNIVERSITY_ENTRANCE_FEE.private_science);
  });
});

describe('university annual values reflect updated MEXT/JASSO bases (案 A)', () => {
  it('private > public, away > home, science > humanities — invariants preserved', () => {
    const at20 = (uni: UniversityPath, living: UniversityLiving) =>
      eduCostForChild(makeChild({ age: 20, uni, living }), 20);
    expect(at20('private_humanities', 'home')).toBeGreaterThan(at20('public_humanities', 'home'));
    expect(at20('private_science', 'home')).toBeGreaterThan(at20('private_humanities', 'home'));
    expect(at20('public_science', 'home')).toBeGreaterThan(at20('public_humanities', 'home'));
    expect(at20('private_science', 'away')).toBeGreaterThan(at20('private_science', 'home'));
    expect(at20('none', 'home')).toBe(0);
  });
});
