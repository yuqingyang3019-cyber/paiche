from __future__ import annotations

from pathlib import Path

# 仅使用预生成的空白模板，不直接读取根目录样例表
TEMPLATE_PATH = Path(__file__).resolve().parent.parent / "template" / "wuda-junzheng.xlsx"
DATA_START_ROW = 3
FACTORY = "乌达君正"
DEFAULT_QUANTITY = 37
DEFAULT_DESTINATION = "后旗团羊"

COL_FACTORY = 1
COL_PLATE = 2
COL_NAME = 4
COL_ID_CARD = 5
COL_PHONE = 6
COL_QTY_A = 7
COL_QTY_B = 8
COL_DESTINATION = 9
