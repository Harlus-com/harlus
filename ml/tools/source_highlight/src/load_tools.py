import sys
sys.path.append("/Users/ronald/Documents/code/harlus/ml/tools/doc_search/src")
from harlus_doc_search.node_pipeline import NodePipeline
from harlus_doc_search.doc_tool_pipeline import DocumentPipeline
import nest_asyncio
nest_asyncio.apply()
import pickle
import json
file_path_source = "/Users/ronald/Documents/code/harlus/ml/tools/contrast_tool/dev/Harlus AAPL Q1 2025.pdf"
file_path_target = "/Users/ronald/Documents/code/harlus/ml/tools/contrast_tool/dev/Apple - Earnings Call - Q2 2025.pdf"


async def load_tools(use_cached=True):

    if use_cached:
        tw_source = pickle.load(open("tws.pkl", "rb"))
        tw_target = pickle.load(open("twt.pkl", "rb"))
    else:
        npl_source = NodePipeline(file_path=file_path_source)
        _, nodes_json_source, nodes_source = await npl_source.execute()
        pickle.dump(nodes_source, open("nodess.pkl", "wb"))
        with open("nodess_json.json", "w") as f:
            f.write(nodes_json_source)
        dpl_source = DocumentPipeline(nodes=nodes_source, file_path=file_path_source, file_name="Harlus AAPL Q1 2025.pdf")
        tw_source = await dpl_source.execute()
        pickle.dump(tw_source, open("tws.pkl", "wb"))

        npl_target = NodePipeline(file_path=file_path_target)
        _, nodes_json_target, nodes_target = await npl_target.execute()
        pickle.dump(nodes_target, open("nodest.pkl", "wb"))
        with open("nodest_json.json", "w") as f:
            f.write(nodes_json_target)
        dpl_target = DocumentPipeline(nodes=nodes_target, file_path=file_path_target, file_name="Apple - Earnings Call - Q2 2025.pdf")
        tw_target = await dpl_target.execute()
        pickle.dump(tw_target, open("twt.pkl", "wb"))

    return tw_source, tw_target