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
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.listing.InstructionIterator;

public class ExportDecompiled extends GhidraScript {

    @Override
    public void run() throws Exception {
        // Output filenames matching binary path
        File cFile = new File(currentProgram.getExecutablePath() + ".c");
        File jsonFile = new File(currentProgram.getExecutablePath() + "_meta.json");
        
        println("Exporting decompilation results to: " + cFile.getAbsolutePath());
        
        DecompInterface decomp = new DecompInterface();
        decomp.openProgram(currentProgram);

        // Auto-disassembly and function discovery pass for raw binaries
        FunctionIterator initialFuncs = currentProgram.getFunctionManager().getFunctions(true);
        if (!initialFuncs.hasNext()) {
            println("No functions identified. Running entry point discovery and forced disassembly...");
            
            // Try ARM vector table entry discovery (offset 4)
            try {
                if (currentProgram.getLanguage().getLanguageID().toString().contains("ARM")) {
                    int offsetRaw = currentProgram.getMemory().getInt(currentProgram.getMinAddress().add(4));
                    long offset = ((long) offsetRaw) & 0xFFFFFFFFL;
                    offset = offset & ~1L; // Mask Thumb bit
                    ghidra.program.model.address.Address entryAddr = currentProgram.getMinAddress().getNewAddress(offset);
                    println("ARM Reset Vector detected: " + entryAddr);
                    disassemble(entryAddr);
                    createFunction(entryAddr, "entry");
                }
            } catch (Exception ex) {
                println("Failed ARM vector discovery: " + ex.getMessage());
            }

            // Forced disassembly of execute blocks
            ghidra.program.model.mem.MemoryBlock[] blocks = currentProgram.getMemory().getBlocks();
            for (ghidra.program.model.mem.MemoryBlock block : blocks) {
                if (block.isExecute()) {
                    println("Forced disassembly on executable block: " + block.getName());
                    disassemble(block.getStart());
                }
            }

            // Run analysis to compile new functions
            analyzeAll(currentProgram);
        }
        
        PrintWriter cWriter = new PrintWriter(new FileWriter(cFile));
        cWriter.println("// Decompiled code for " + currentProgram.getName());
        cWriter.println("// Processor: " + currentProgram.getLanguage().getLanguageID());
        cWriter.println();
        
        List<String> functionJsonBlocks = new ArrayList<>();
        
        // Iterate through all decompiled functions
        FunctionIterator functions = currentProgram.getFunctionManager().getFunctions(true);
        while (functions.hasNext() && !monitor.isCancelled()) {
            Function f = functions.next();
            
            println("Decompiling function: " + f.getName());
            DecompileResults results = decomp.decompileFunction(f, 60, monitor);
            String pseudoC = "";
            if (results != null && results.decompileCompleted()) {
                DecompiledFunction df = results.getDecompiledFunction();
                pseudoC = df.getC();
                cWriter.println(pseudoC);
                cWriter.println();
            } else {
                pseudoC = "// Failed to decompile function: " + f.getName();
                cWriter.println(pseudoC);
                cWriter.println();
            }
            
            // Extract assembly instructions
            StringBuilder asmBuilder = new StringBuilder();
            try {
                InstructionIterator instructions = currentProgram.getListing().getInstructions(f.getBody(), true);
                while (instructions.hasNext() && !monitor.isCancelled()) {
                    Instruction inst = instructions.next();
                    asmBuilder.append("0x").append(Long.toHexString(inst.getMinAddress().getOffset())).append(": ");
                    asmBuilder.append(inst.toString()).append("\n");
                }
            } catch (Exception ex) {
                asmBuilder.append("; Failed to extract assembly: ").append(ex.getMessage());
            }
            
            long fSize = 0;
            try {
                fSize = f.getBody().getMaxAddress().getOffset() - f.getEntryPoint().getOffset() + 1;
            } catch (Exception ex) {
                // fall back to default size if range cannot be determined
                fSize = 64;
            }
            
            StringBuilder funcObj = new StringBuilder();
            funcObj.append("    {\n");
            funcObj.append("      \"name\": \"").append(escapeJson(f.getName())).append("\",\n");
            funcObj.append("      \"address\": \"0x").append(Long.toHexString(f.getEntryPoint().getOffset())).append("\",\n");
            funcObj.append("      \"size\": ").append(fSize).append(",\n");
            funcObj.append("      \"pseudo_c\": \"").append(escapeJson(pseudoC)).append("\",\n");
            funcObj.append("      \"assembly\": \"").append(escapeJson(asmBuilder.toString())).append("\"\n");
            funcObj.append("    }");
            functionJsonBlocks.add(funcObj.toString());
        }
        cWriter.close();
        
        // Extract defined strings (limited to 500 for performance)
        List<String> stringJsonBlocks = new ArrayList<>();
        try {
            ghidra.program.util.DefinedDataIterator definedStrings = ghidra.program.util.DefinedDataIterator.byDataInstance(currentProgram, data -> {
                ghidra.program.model.data.StringDataInstance sdi = ghidra.program.model.data.StringDataInstance.getStringDataInstance(data);
                return sdi != null && sdi.getStringValue() != null;
            });
            int stringCount = 0;
            while (definedStrings.hasNext() && !monitor.isCancelled()) {
                ghidra.program.model.listing.Data data = definedStrings.next();
                ghidra.program.model.data.StringDataInstance sdi = ghidra.program.model.data.StringDataInstance.getStringDataInstance(data);
                if (sdi != null) {
                    String val = sdi.getStringValue();
                    if (val != null && !val.trim().isEmpty()) {
                        StringBuilder sObj = new StringBuilder();
                        sObj.append("    {\n");
                        sObj.append("      \"address\": \"0x").append(Long.toHexString(data.getAddress().getOffset())).append("\",\n");
                        sObj.append("      \"value\": \"").append(escapeJson(val)).append("\",\n");
                        sObj.append("      \"encoding\": \"ASCII\"\n");
                        sObj.append("    }");
                        stringJsonBlocks.add(sObj.toString());
                        if (++stringCount >= 500) {
                            break;
                        }
                    }
                }
            }
        } catch (Exception ex) {
            println("Error extracting strings: " + ex.getMessage());
        }
        
        // Extract defined symbols (limited to 1000 for performance)
        List<String> symbolJsonBlocks = new ArrayList<>();
        try {
            ghidra.program.model.symbol.SymbolTable symbolTable = currentProgram.getSymbolTable();
            ghidra.program.model.symbol.SymbolIterator symbolIterator = symbolTable.getDefinedSymbols();
            int symbolCount = 0;
            while (symbolIterator.hasNext() && !monitor.isCancelled()) {
                ghidra.program.model.symbol.Symbol symbol = symbolIterator.next();
                String typeStr = symbol.getSymbolType().toString();
                
                if (symbol.isGlobal() || typeStr.equals("Function") || typeStr.equals("Label")) {
                    StringBuilder symObj = new StringBuilder();
                    symObj.append("    {\n");
                    symObj.append("      \"address\": \"0x").append(Long.toHexString(symbol.getAddress().getOffset())).append("\",\n");
                    symObj.append("      \"name\": \"").append(escapeJson(symbol.getName())).append("\",\n");
                    symObj.append("      \"type\": \"").append(escapeJson(typeStr)).append("\"\n");
                    symObj.append("    }");
                    symbolJsonBlocks.add(symObj.toString());
                    if (++symbolCount >= 1000) {
                        break;
                    }
                }
            }
        } catch (Exception ex) {
            println("Error extracting symbols: " + ex.getMessage());
        }
        
        // Write rich metadata JSON
        PrintWriter jsonWriter = new PrintWriter(new FileWriter(jsonFile));
        jsonWriter.println("{");
        jsonWriter.println("  \"entry_point\": \"0x" + Long.toHexString(currentProgram.getImageBase().getOffset()) + "\",");
        
        // Functions
        jsonWriter.println("  \"functions\": [");
        for (int i = 0; i < functionJsonBlocks.size(); i++) {
            jsonWriter.print(functionJsonBlocks.get(i));
            if (i < functionJsonBlocks.size() - 1) jsonWriter.println(",");
            else jsonWriter.println();
        }
        jsonWriter.println("  ],");

        // Strings
        jsonWriter.println("  \"strings\": [");
        for (int i = 0; i < stringJsonBlocks.size(); i++) {
            jsonWriter.print(stringJsonBlocks.get(i));
            if (i < stringJsonBlocks.size() - 1) jsonWriter.println(",");
            else jsonWriter.println();
        }
        jsonWriter.println("  ],");

        // Symbols
        jsonWriter.println("  \"symbols\": [");
        for (int i = 0; i < symbolJsonBlocks.size(); i++) {
            jsonWriter.print(symbolJsonBlocks.get(i));
            if (i < symbolJsonBlocks.size() - 1) jsonWriter.println(",");
            else jsonWriter.println();
        }
        jsonWriter.println("  ],");
        
        jsonWriter.println("  \"assembly\": \"// Headless decompilation assembly preview\"");
        jsonWriter.println("}");
        jsonWriter.close();
        
        println("REPORT: Export completed.");
    }
    
    private String escapeJson(String string) {
        if (string == null || string.length() == 0) {
            return "";
        }

        char         c = 0;
        int          i;
        int          len = string.length();
        StringBuilder sb = new StringBuilder(len + 4);
        String       t;

        for (i = 0; i < len; i += 1) {
            c = string.charAt(i);
            switch (c) {
            case '\\':
            case '"':
                sb.append('\\');
                sb.append(c);
                break;
            case '/':
                sb.append('\\');
                sb.append(c);
                break;
            case '\b':
                sb.append("\\b");
                break;
            case '\t':
                sb.append("\\t");
                break;
            case '\n':
                sb.append("\\n");
                break;
            case '\f':
                sb.append("\\f");
                break;
            case '\r':
                sb.append("\\r");
                break;
            default:
                if (c < ' ') {
                    t = "000" + Integer.toHexString(c);
                    sb.append("\\u" + t.substring(t.length() - 4));
                } else {
                    sb.append(c);
                }
            }
        }
        return sb.toString();
    }
}

