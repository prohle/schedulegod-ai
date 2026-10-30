"""Any-format extraction: messy institutional files -> readable text.

Fixtures are built in-memory (a real .docx and .xlsx are just zips of XML;
the PDF is a minimal hand-built document with a text layer), so these tests
prove the format layer without binary blobs in the repo.
"""

import io
import zipfile

from app.ingestion.extract import extract_text


def _docx(text_lines: list[str]) -> bytes:
    paras = "".join(
        f'<w:p><w:r><w:t>{line}</w:t></w:r></w:p>' for line in text_lines)
    xml = ('<?xml version="1.0"?>'
           '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
           f"<w:body>{paras}</w:body></w:document>")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("word/document.xml", xml)
    return buf.getvalue()


def _xlsx(rows: list[list[str]]) -> bytes:
    shared = list(dict.fromkeys(c for row in rows for c in row))
    si = "".join(f"<si><t>{s}</t></si>" for s in shared)
    shared_xml = ('<?xml version="1.0"?>'
                  '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                  f"{si}</sst>")
    row_xml = ""
    for row in rows:
        cells = "".join(f'<c t="s"><v>{shared.index(c)}</v></c>' for c in row)
        row_xml += f"<row>{cells}</row>"
    sheet_xml = ('<?xml version="1.0"?>'
                 '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                 f"<sheetData>{row_xml}</sheetData></worksheet>")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("xl/sharedStrings.xml", shared_xml)
        z.writestr("xl/worksheets/sheet1.xml", sheet_xml)
    return buf.getvalue()


def _pdf(text: str) -> bytes:
    stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objs, 1):
        offsets.append(out.tell())
        out.write(f"{i} 0 obj\n".encode() + body + b"\nendobj\n")
    xref = out.tell()
    out.write(f"xref\n0 {len(objs) + 1}\n".encode())
    out.write(b"0000000000 65535 f \n")
    for off in offsets:
        out.write(f"{off:010d} 00000 n \n".encode())
    out.write(f"trailer << /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode())
    return out.getvalue()


def test_extracts_docx_xlsx_pdf_csv_and_zip():
    docx = extract_text("faculty-memo.docx", _docx(["Prof. Chen teaches CS 301, CS 310"]))
    assert "Prof. Chen teaches CS 301, CS 310" in docx

    xlsx = extract_text("rooms.xlsx", _xlsx([["Room", "Capacity"], ["Science 101", "36"]]))
    assert "Room | Capacity" in xlsx and "Science 101 | 36" in xlsx

    pdf = extract_text("catalog.pdf", _pdf("CS 101 Intro MWF lecture"))
    assert "CS 101 Intro MWF lecture" in pdf

    csv = extract_text("cohorts.csv", b"cohort,size\nCS 2025,45\n")
    assert "CS 2025,45" in csv

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("notes.txt", "Prof. Patel teaches CS 101")
        z.writestr("rooms.xlsx", _xlsx([["Library 201", "35"]]))
    zipped = extract_text("registrar-dump.zip", buf.getvalue())
    assert "Prof. Patel teaches CS 101" in zipped
    assert "Library 201 | 35" in zipped


def test_images_and_garbage_never_crash():
    assert "no extractable text" in extract_text("photo.png", b"\x89PNG fake")
    assert "unreadable" in extract_text("broken.pdf", b"not a pdf at all")
    assert "hello" in extract_text("notes.txt", b"hello")
