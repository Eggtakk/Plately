import csv
from pathlib import Path
from pipeline.muslim_share import national_muslim_fraction, MUSLIM_FRACTION, OTHER_MUSLIM_FRACTION


def _write(tmp_path, rows):
    p = tmp_path / "country.csv"
    with p.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["국가명", "비율(%)"])
        w.writerows(rows)
    return p


def test_single_country_exact(tmp_path):
    p = _write(tmp_path, [["인도네시아", "10.0"]])
    assert national_muslim_fraction(p) == round(0.10 * MUSLIM_FRACTION["인도네시아"], 4)


def test_unmapped_country_contributes_zero(tmp_path):
    p = _write(tmp_path, [["일본", "50.0"], ["대만", "50.0"]])
    got = national_muslim_fraction(p)
    assert got == round(0.5 * MUSLIM_FRACTION["일본"] + 0.5 * MUSLIM_FRACTION["대만"], 4)
    assert got < 0.01


def test_etc_uses_other_fraction(tmp_path):
    p = _write(tmp_path, [["기타", "20.0"]])
    assert national_muslim_fraction(p) == round(0.20 * OTHER_MUSLIM_FRACTION, 4)


def test_empty_csv_is_zero(tmp_path):
    p = _write(tmp_path, [])
    assert national_muslim_fraction(p) == 0.0


def test_result_in_unit_range_for_realistic_mix(tmp_path):
    p = _write(tmp_path, [
        ["중국", "25.8"], ["일본", "10.9"], ["미국", "9.3"], ["대만", "7.7"],
        ["필리핀", "4.8"], ["베트남", "4.2"], ["홍콩", "3.3"], ["인도네시아", "3.3"],
        ["싱가포르", "2.6"], ["말레이시아", "1.9"], ["태국", "1.7"], ["캐나다", "1.6"],
        ["호주", "1.5"], ["러시아", "1.4"], ["인도", "1.3"], ["영국", "1.3"],
        ["독일", "1.2"], ["몽골", "1.1"], ["프랑스", "0.9"], ["카자흐스탄", "0.5"],
        ["튀르키예", "0.5"], ["멕시코", "0.4"], ["아랍에미리트", "0.1"], ["기타", "12.6"],
    ])
    got = national_muslim_fraction(p)
    assert 0.03 < got < 0.12   # 대략 5~8% 예상


def test_every_csv_country_is_in_the_table():
    # 실제 export 의 23개국이 전부 MUSLIM_FRACTION 에 있어야 미매핑 경고가 안 뜬다
    expected = {"호주","캐나다","중국","대만","프랑스","독일","홍콩","인도","인도네시아","일본",
                "카자흐스탄","말레이시아","멕시코","몽골","필리핀","러시아","싱가포르","베트남",
                "태국","아랍에미리트","튀르키예","영국","미국"}
    assert expected <= set(MUSLIM_FRACTION)
