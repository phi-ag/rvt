import { expect } from "jsr:@std/expect";
import { describe, it } from "jsr:@std/testing/bdd";

import { openPath } from "../../dist/deno.js";
import { basicFileInfo, thumbnail } from "../../dist/index.js";

describe("deno", () => {
  it("family 2016", async () => {
    using file = await openPath(
      "../../examples/Autodesk/rac_basic_sample_family-2016.rfa"
    );
    const info = await basicFileInfo(file.data);
    const image = await thumbnail(file.data);

    expect(info.version).toBe("2016");
    expect(info.build).toBe("20150110_1515(x64)");
    expect(info.locale).toBe("ENU");
    expect(info.identityId).toBe("00000000-0000-0000-0000-000000000000");
    expect(info.documentId).toBe("d713e470-f080-49fb-b78e-9e7ea68ec135");
    expect(info.path).toBe(
      "C:\\Content_Inst_P4\\Release\\2016\\RTM\\Content\\English\\Samples\\RAC\\Samples\\rac_basic_sample_family1.rfa"
    );
    expect(info.content).toMatch(/^Worksharing:/);
    expect(image).toBeDefined();
  });

  it("family 2026", async () => {
    using file = await openPath("../../examples/Autodesk/racbasicsamplefamily-2026.rfa");
    const info = await basicFileInfo(file.data);
    const image = await thumbnail(file.data);

    expect(info.version).toBe("2026");
    expect(info.build).toBe("20250227_1515(x64)");
    expect(info.locale).toBe("ENU");
    expect(info.identityId).toBe("00000000-0000-0000-0000-000000000000");
    expect(info.documentId).toBe("5ee56283-7ce7-4af9-8c63-7265dce3247d");
    expect(info.path).toBe(
      "C:\\Users\\hansonje\\Desktop\\Downloadable Files\\racbasicsamplefamily.rfa"
    );
    expect(info.content).toMatch(/^Worksharing:/);
    expect(image).toBeDefined();
  });
});
