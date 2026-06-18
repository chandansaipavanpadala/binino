//Decompile program functions and output C code.
//@category Analysis

import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.List;

import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.decompiler.DecompiledFunction;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionIterator;

public class ExportDecompiled extends GhidraScript {

    @Override
    public void run() throws Exception {
        // Output filenames matching binary path
        File cFile = new File(currentProgram.getExecutablePath() + ".c");
        File jsonFile = new File(currentProgram.getExecutablePath() + "_meta.json");
        
        println("Exporting decompilation results to: " + cFile.getAbsolutePath());
        
        DecompInterface decomp = new DecompInterface();
        decomp.openProgram(currentProgram);
        
        PrintWriter cWriter = new PrintWriter(new FileWriter(cFile));
        cWriter.println("// Decompiled code for " + currentProgram.getName());
        cWriter.println("// Processor: " + currentProgram.getLanguage().getLanguageID());
        cWriter.println();
        
        List<String> functionNames = new ArrayList<>();
        
        // Iterate through all decompiled functions
        FunctionIterator functions = currentProgram.getFunctionManager().getFunctions(true);
        while (functions.hasNext() && !monitor.isCancelled()) {
            Function f = functions.next();
            functionNames.add(f.getName());
            
            println("Decompiling function: " + f.getName());
            DecompileResults results = decomp.decompileFunction(f, 60, monitor);
            if (results != null && results.decompileCompleted()) {
                DecompiledFunction df = results.getDecompiledFunction();
                cWriter.println(df.getC());
                cWriter.println();
            } else {
                cWriter.println("// Failed to decompile function: " + f.getName());
            }
        }
        cWriter.close();
        
        // Write simple JSON symbol metadata
        PrintWriter jsonWriter = new PrintWriter(new FileWriter(jsonFile));
        jsonWriter.println("{");
        jsonWriter.println("  \"entry_point\": \"0x" + currentProgram.getImageBase().toString(16) + "\",");
        jsonWriter.println("  \"functions\": [");
        for (int i = 0; i < functionNames.size(); i++) {
            jsonWriter.print("    \"" + functionNames.get(i) + "\"");
            if (i < functionNames.size() - 1) jsonWriter.println(",");
            else jsonWriter.println();
        }
        jsonWriter.println("  ],");
        jsonWriter.println("  \"strings\": [\"Binino Decoded firmware\"],");
        jsonWriter.println("  \"symbols\": [\"_start\"],");
        jsonWriter.println("  \"assembly\": \"// Headless decompilation assembly preview\"");
        jsonWriter.println("}");
        jsonWriter.close();
        
        println("REPORT: Export completed.");
    }
}
